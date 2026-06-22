import json
import math
import os
import time
from functools import wraps

import requests
from flask import Flask, jsonify, render_template

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DISTRICT_JSON_PATH = os.path.join(BASE_DIR, 'public', 'data', 'india_district.geojson')

app = Flask(
    __name__,
    static_folder='static',
    template_folder='templates'
)

CACHE_TTL = 300
cache = {
    'districts': None,
    'heatmap': {'ts': 0, 'points': []},
    'weather': {},
    'forecast': {}
}

OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'
OPEN_METEO_GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search'
OPEN_METEO_AQI_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality'


def normalize_label(value):
    if not isinstance(value, str):
        return ''
    return ' '.join(value.strip().lower().split())


def polygon_centroid(coords):
    area = 0.0
    cx = 0.0
    cy = 0.0
    for i in range(len(coords) - 1):
        x0, y0 = coords[i]
        x1, y1 = coords[i + 1]
        factor = x0 * y1 - x1 * y0
        area += factor
        cx += (x0 + x1) * factor
        cy += (y0 + y1) * factor
    if abs(area) < 1e-12:
        return coords[0]
    area *= 0.5
    cx /= (6.0 * area)
    cy /= (6.0 * area)
    return [cy, cx]


def multi_polygon_centroid(multi_polygons):
    best = None
    best_area = 0
    for polygon in multi_polygons:
        coords = polygon[0]
        if len(coords) < 3:
            continue
        area = 0.0
        for i in range(len(coords) - 1):
            x0, y0 = coords[i]
            x1, y1 = coords[i + 1]
            area += x0 * y1 - x1 * y0
        if abs(area) > best_area:
            best_area = abs(area)
            best = coords
    return polygon_centroid(best) if best else [0.0, 0.0]


def compute_feature_center(feature):
    geometry = feature.get('geometry', {})
    geom_type = geometry.get('type')
    coordinates = geometry.get('coordinates', [])

    if geom_type == 'Polygon':
        return polygon_centroid(coordinates[0])
    if geom_type == 'MultiPolygon':
        return multi_polygon_centroid(coordinates)
    return [0.0, 0.0]


def load_districts():
    if cache['districts'] is not None:
        return cache['districts']

    with open(DISTRICT_JSON_PATH, 'r', encoding='utf-8') as handle:
        data = json.load(handle)

    features = []
    for feature in data.get('features', []):
        props = feature.get('properties', {})
        district_name = props.get('DISTRICT') or props.get('district') or props.get('DIST_NAME')
        state_name = props.get('STATE') or props.get('state') or props.get('ST_NM')
        title = f"{district_name}, {state_name}" if district_name and state_name else district_name or state_name
        center = compute_feature_center(feature)
        feature_props = {
            'district': district_name,
            'state': state_name,
            'title': title,
            'center': center,
        }
        feature['properties'] = feature_props
        features.append(feature)

    geojson = {'type': 'FeatureCollection', 'features': features}
    cache['districts'] = geojson
    return geojson


def cache_result(bucket, key, ttl=CACHE_TTL):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            entry = cache[bucket].get(key)
            if entry:
                value, ts = entry
                if time.time() - ts < ttl:
                    return value
            value = func(*args, **kwargs)
            cache[bucket][key] = (value, time.time())
            return value
        return wrapper
    return decorator


def get_weather_url(lat, lon):
    return f"{OPEN_METEO_URL}?latitude={lat}&longitude={lon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,precipitation_probability,windspeed_10m,winddirection_10m,surface_pressure,cloudcover&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,weathercode&timezone=Asia%2FKolkata"


def get_aqi_url(lat, lon):
    return f"{OPEN_METEO_AQI_URL}?latitude={lat}&longitude={lon}&hourly=pm10,pm2_5,no2,o3,co,so2&timezone=Asia%2FKolkata"


def approximate_temperature(lat, lon):
    hour = (time.time() / 3600) % 24
    seasonal = (math.sin((lat - 20) / 18.0) + 1.2) * 8
    diurnal = math.cos((hour - 14) / 12.0 * math.pi) * 5
    long_adjust = (lon - 78) / 45.0 * 3
    return round(18 + seasonal + diurnal + long_adjust, 1)


def get_cached_weather(cache_key, lat, lon):
    entry = cache['weather'].get(cache_key)
    if entry:
        payload, ts = entry
        if time.time() - ts < CACHE_TTL:
            return payload
    return None


def get_cached_forecast(cache_key, lat, lon):
    entry = cache['forecast'].get(cache_key)
    if entry:
        payload, ts = entry
        if time.time() - ts < CACHE_TTL:
            return payload
    return None


def fetch_weather(lat, lon):
    cache_key = f"{lat:.5f},{lon:.5f}"
    cached = get_cached_weather(cache_key, lat, lon)
    if cached:
        return cached

    response = requests.get(get_weather_url(lat, lon), timeout=15)
    response.raise_for_status()
    weather_json = response.json()

    aqi = None
    try:
        aqi_response = requests.get(get_aqi_url(lat, lon), timeout=15)
        aqi_response.raise_for_status()
        aqi = aqi_response.json()
    except requests.RequestException:
        aqi = {}

    current = weather_json.get('current_weather', {})
    hourly = weather_json.get('hourly', {})
    daily = weather_json.get('daily', {})

    result = {
        'current': {
            'temperature': current.get('temperature'),
            'windspeed': current.get('windspeed'),
            'winddirection': current.get('winddirection'),
            'weathercode': current.get('weathercode'),
            'time': current.get('time')
        },
        'hourly': {
            'time': hourly.get('time', []),
            'temperature_2m': hourly.get('temperature_2m', []),
            'relativehumidity_2m': hourly.get('relativehumidity_2m', []),
            'precipitation_probability': hourly.get('precipitation_probability', []),
            'windspeed_10m': hourly.get('windspeed_10m', []),
            'winddirection_10m': hourly.get('winddirection_10m', []),
            'surface_pressure': hourly.get('surface_pressure', [])
        },
        'daily': {
            'time': daily.get('time', []),
            'temperature_2m_max': daily.get('temperature_2m_max', []),
            'temperature_2m_min': daily.get('temperature_2m_min', []),
            'precipitation_probability_max': daily.get('precipitation_probability_max', []),
            'sunrise': daily.get('sunrise', []),
            'sunset': daily.get('sunset', []),
            'weathercode': daily.get('weathercode', [])
        },
        'aqi': aqi,
        'timestamp': int(time.time())
    }
    cache['weather'][cache_key] = (result, time.time())
    return result


def build_heat_points():
    districts = load_districts()['features']
    points = []
    for feature in districts:
        center = feature['properties']['center']
        lat, lon = center
        temp = approximate_temperature(lat, lon)
        cache_key = f"{lat:.5f},{lon:.5f}"
        if cache_key in cache['weather']:
            temp = cache['weather'][cache_key][0]['current'].get('temperature', temp)
        points.append({'lat': lat, 'lon': lon, 'value': temp})
    return points


@app.route('/')
def homepage():
    return render_template('index.html')


@app.route('/districts')
def districts():
    return jsonify(load_districts())


@app.route('/heatmap')
def heatmap():
    if time.time() - cache['heatmap']['ts'] < CACHE_TTL and cache['heatmap']['points']:
        return jsonify({'points': cache['heatmap']['points']})
    points = build_heat_points()
    cache['heatmap']['points'] = points
    cache['heatmap']['ts'] = time.time()
    return jsonify({'points': points})


@app.route('/weather/<path:district_name>')
def weather_for_district(district_name):
    normalized = normalize_label(district_name)
    districts_data = load_districts()['features']
    found = None
    for feature in districts_data:
        if normalize_label(feature['properties'].get('district', '')) == normalized:
            found = feature
            break
    if not found:
        return jsonify({'error': 'District not found'}), 404

    lat, lon = found['properties']['center']
    weather = fetch_weather(lat, lon)
    return jsonify({
        'district': found['properties']['district'],
        'state': found['properties']['state'],
        'center': {'lat': lat, 'lon': lon},
        'weather': weather
    })


@app.route('/forecast/<path:district_name>')
def forecast_for_district(district_name):
    normalized = normalize_label(district_name)
    districts_data = load_districts()['features']
    found = None
    for feature in districts_data:
        if normalize_label(feature['properties'].get('district', '')) == normalized:
            found = feature
            break
    if not found:
        return jsonify({'error': 'District not found'}), 404

    lat, lon = found['properties']['center']
    weather = fetch_weather(lat, lon)
    return jsonify({
        'district': found['properties']['district'],
        'state': found['properties']['state'],
        'center': {'lat': lat, 'lon': lon},
        'forecast': weather['daily']
    })


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
