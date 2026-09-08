import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar
} from 'recharts'
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker
} from 'react-simple-maps'
import { geoCentroid, geoMercator } from 'd3'
import './App.css'
import { fetchJson, describeFetchError } from './utils/fetchJson'
import { setBulkWeatherCache, getBulkWeatherLastUpdated, normaliseBulkCities } from './utils/bulkWeatherCache'
import { refreshStateLive, getStateRefreshedAt, refreshAllStatesSample } from './utils/stateLiveRefresh'
import { useLiteMode } from './utils/liteMode'
import PanelIcon from './components/PanelIcon'
import CityTrendPanel from './components/CityTrendPanel'
import SatelliteLstPanel from './components/SatelliteLstPanel'
import MitigationPlanner from './components/MitigationPlanner'
import AppErrorBoundary from './components/AppErrorBoundary'
import { getCityData } from './utils/realData'
import { getBuildingDensity } from './utils/osmUtils'
import { SourceBadge } from './components/DataBadges'
import { MLModelPanel } from './components/MLModelPanel'
import { LandCoverPanel } from './components/LandCoverPanel'
import { PhysicsPanel } from './components/PhysicsPanel'
import { CoolRoofCalculator } from './components/CoolRoofCalculator'
import { GEEPipelinePanel } from './components/GEEPipelinePanel'
import { normalizeStateName, getCellTemp, getGridBucket, computeInterventionImpact, getUsers, getLoginHistory, saveLoginHistory, getAnalyticsData, getTimeSpent } from './utils/dashboardUtils'
import { WeatherCard } from './components/WeatherCard'
import { getAQICategory } from './utils/weatherAPI'
import { useWeather } from './hooks/useWeather'
import { loadCityCoordinates } from './utils/cityCoordinateResolver'
import { getLulcWithFallback } from './utils/lulcFallback'
import { generatePDF } from './utils/exportUtils'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, changeLanguage } from './i18n'
import { AIAnalystPanel } from './components/AIAnalystPanel'
import { FloatingAIAssistant } from './components/FloatingAIAssistant'
import { CompareCitiesPanel } from './components/CompareCitiesPanel'
import ViewModeToggle from './components/ViewModeToggle'
import AudienceToggle from './components/AudienceToggle'
import HeatActionChecklist from './components/HeatActionChecklist'
import { useViewMode } from './hooks/useViewMode'
import { useAudienceMode } from './hooks/useAudienceMode'

// Gemini API key is never read on the client. The AI Analyst calls the secure
// /api/ask-ai backend proxy (see api/ask-ai.js + api/_lib/askAI.js), which reads
// GEMINI_API_KEY from a server-side-only env var.

const INDIA_GEO_URL =
  'https://cdn.jsdelivr.net/gh/udit-001/india-maps-data@ef25ebc/topojson/india.json'

const GEO_URL = 'https://cdn.jsdelivr.net/gh/udit-001/india-maps-data@ef25ebc/topojson/india.json'

const PROJECTION_CONFIG = {
  center: [80, 22],
  scale: 1000
}




const STATE_ABBR = {
  "Andhra Pradesh":"AP","Arunachal Pradesh":"AR","Assam":"AS","Bihar":"BR","Chhattisgarh":"CG",
  "Goa":"GA","Gujarat":"GJ","Haryana":"HR","Himachal Pradesh":"HP","Jharkhand":"JH",
  "Karnataka":"KA","Kerala":"KL","Madhya Pradesh":"MP","Maharashtra":"MH","Manipur":"MN",
  "Meghalaya":"ML","Mizoram":"MZ","Nagaland":"NL","Odisha":"OD","Punjab":"PB","Rajasthan":"RJ",
  "Sikkim":"SK","Tamil Nadu":"TN","Telangana":"TG","Tripura":"TR","Uttar Pradesh":"UP",
  "Uttarakhand":"UK","West Bengal":"WB","Jammu and Kashmir":"JK","Ladakh":"LA","Delhi":"DL",
  "Chandigarh":"CH","Puducherry":"PY","Andaman and Nicobar Islands":"AN","Lakshadweep":"LD",
  "Dadra and Nagar Haveli and Daman and Diu":"DD"
}

const STATE_DATA = {

"Andhra Pradesh": {
  avgLST:42, risk:"HIGH",
  ndvi:0.28, ndbi:0.37, ndwi:-0.09, aqi:130,
  coastal:true,
  cities:["Visakhapatnam","Vijayawada","Guntur","Tirupati","Kurnool","Nellore","Rajahmundry","Kakinada","Kadapa","Anantapur","Vizianagaram","Eluru","Ongole","Nandyal","Machilipatnam","Adoni","Tenali","Proddatur","Chittoor","Hindupur","Bhimavaram","Madanapalle","Guntakal","Dharmavaram","Gudivada","Narasaraopet","Tadipatri","Tadepalligudem","Chilakaluripet","Yemmiganur","Kavali","Palacole","Srikakulam","Bobbili","Rajam","Pithapuram","Amalapuram","Ponnur","Bapatla","Mangalagiri","Amaravati","Puttaparthi","Sullurpeta","Nakkalammapeta","Rajampet","Pileru","Venkatagiri","Gudur","Srikalahasti","Nagari","Puttur"]
},

"Arunachal Pradesh": {
  avgLST:28, risk:"COOL",
  ndvi:0.70, ndbi:0.08, ndwi:0.25, aqi:35,
  coastal:false,
  cities:["Itanagar","Naharlagun","Pasighat","Tawang","Ziro","Bomdila","Along","Tezu","Roing","Namsai","Changlang","Khonsa","Longding","Anini","Daporijo","Yingkiong","Seppa","Koloriang","Hayuliang","Deomali","Miao","Jairampur","Margherita","Bordumsa","Wakro","Manmao","Chowkham","Lekang","Pumao","Borduria","Talung","Mechuka","Tuting","Gelling","Kibithoo","Walong","Pangkang","Hawai"]
},

"Assam": {
  avgLST:35, risk:"MODERATE",
  ndvi:0.52, ndbi:0.20, ndwi:0.08, aqi:85,
  coastal:false,
  cities:["Guwahati","Silchar","Dibrugarh","Jorhat","Nagaon","Tinsukia","Tezpur","Bongaigaon","Dhubri","Diphu","North Lakhimpur","Sivasagar","Goalpara","Barpeta","Mangaldoi","Lumding","Rangiya","Dhemaji","Sibsagar","Karimganj","Hailakandi","Haflong","Bokajan","Morigaon","Hojai","Lanka","Doboka","Jamugurihat","Nalbari","Kamrup","Golaghat","Majuli","Biswanath Chariali","Charaideo","Dima Hasao","Baksa","Chirang","Kokrajhar","Udalguri","Darrang","Sonitpur","Lakhimpur","Tinsukhia","Duliajan","Digboi","Namrup","Dhola","Doom Dooma","Sadiya","Chabua","Moran","Amguri","Nazira","Sonari","Sekoni"]
},

"Bihar": {
  avgLST:44, risk:"EXTREME",
  ndvi:0.30, ndbi:0.38, ndwi:-0.08, aqi:190,
  coastal:false,
  cities:["Patna","Gaya","Muzaffarpur","Bhagalpur","Darbhanga","Purnia","Arrah","Bihar Sharif","Begusarai","Katihar","Munger","Chapra","Saharsa","Hajipur","Dehri","Siwan","Motihari","Nawada","Bettiah","Bagaha","Kishanganj","Sitamarhi","Buxar","Jehanabad","Aurangabad","Sasaram","Mokama","Jamalpur","Madhubani","Supaul","Khagaria","Lakhisarai","Sheikhpura","Nalanda","Rajgir","Bodhgaya","Forbesganj","Jogbani","Narkatiaganj","Raxaul","Mairwa","Gopalganj","Vaishali","Sonepur","Biharsharif","Barbigha","Sheohar","Araria","Madhepura","Samastipur","Rosera","Dalsinghsarai","Tajpur","Barauni","Barh","Fatuha","Khusrupur","Bakhtiyarpur","Hilsa","Islampur","Nokha","Sherghati"]
},

"Chhattisgarh": {
  avgLST:40, risk:"HIGH",
  ndvi:0.40, ndbi:0.32, ndwi:-0.05, aqi:130,
  coastal:false,
  cities:["Raipur","Bhilai","Bilaspur","Korba","Durg","Rajnandgaon","Jagdalpur","Ambikapur","Raigarh","Chirmiri","Dhamtari","Mahasamund","Kanker","Kondagaon","Narayanpur","Bijapur","Sukma","Dantewada","Bemetara","Baloda Bazar","Gariaband","Balod","Mungeli","Kabirdham","Janjgir","Champa","Sakti","Jashpur","Surajpur","Manendragarh","Balrampur","Korea","Surguja","Pendra","Baikunthpur","Pathalgaon","Ramanujganj","Pakhanjore","Konta","Bhanupratappur","Antagarh","Deobhog","Mainpur","Bastar","Tokapal"]
},

"Goa": {
  avgLST:34, risk:"MODERATE",
  ndvi:0.50, ndbi:0.22, ndwi:0.08, aqi:65,
  coastal:true,
  cities:["Panaji","Margao","Vasco da Gama","Mapusa","Ponda","Bicholim","Curchorem","Sanquelim","Cuncolim","Canacona","Quepem","Sanguem","Pernem","Valpoi","Calangute","Baga","Anjuna","Vagator","Colva","Benaulim","Cavelossim","Palolem","Agonda","Chapora","Morjim","Arambol","Mandrem","Ashvem","Candolim","Sinquerim","Dona Paula","Bambolim","Taleigao","Chicalim","Dabolim","Zuarinagar","Cortalim","Sancoale","Mormugao"]
},

"Gujarat": {
  avgLST:45, risk:"EXTREME",
  ndvi:0.15, ndbi:0.45, ndwi:-0.16, aqi:175,
  coastal:true,
  cities:["Ahmedabad","Surat","Vadodara","Rajkot","Bhavnagar","Jamnagar","Junagadh","Gandhinagar","Anand","Navsari","Morbi","Nadiad","Surendranagar","Bharuch","Mehsana","Bhuj","Porbandar","Palanpur","Valsad","Amreli","Ankleshwar","Botad","Dahod","Godhra","Himatnagar","Kalol","Kapadvanj","Keshod","Kheda","Kutch","Limbdi","Lunawada","Mahuva","Mangrol","Modasa","Morva Hadaf","Mundra","Patan","Petlad","Radhanpur","Rajpipla","Sanand","Savarkundla","Sidhpur","Umreth","Una","Upleta","Veraval","Visnagar","Vyara","Wadhwan","Wankaner","Dholka","Dholera","Deesa","Dhoraji","Dwarka","Jetpur","Kalyanpur","Kandla","Lathi","Lodhika","Mandvi","Mithapur","Okha","Palitana","Rajula","Songadh","Talaja","Vapi","Bilimora","Bardoli"]
},

"Haryana": {
  avgLST:42, risk:"HIGH",
  ndvi:0.28, ndbi:0.40, ndwi:-0.10, aqi:175,
  coastal:false,
  cities:["Faridabad","Gurugram","Panipat","Ambala","Yamunanagar","Rohtak","Hisar","Karnal","Sonipat","Panchkula","Bhiwani","Sirsa","Bahadurgarh","Jind","Thanesar","Kaithal","Rewari","Palwal","Hansi","Narnaul","Fatehabad","Gohana","Tohana","Shahabad","Pehowa","Pinjore","Kalka","Nuh","Hodal","Mahendragarh","Mohindergarh","Charkhi Dadri","Jhajjar","Kosli","Hathin","Ballabhgarh","Mewat","Firozpur Jhirka","Rania","Ellenabad","Adampur","Barwala","Uklana","Narwana","Safidon","Assandh","Gharaunda","Indri","Nissing","Taraori","Nilokheri","Chhachhrauli","Bilaspur","Radaur","Sadhaura","Jagadhri","Mustafabad"]
},

"Himachal Pradesh": {
  avgLST:22, risk:"COOL",
  ndvi:0.62, ndbi:0.12, ndwi:0.18, aqi:45,
  coastal:false,
  cities:["Shimla","Dharamshala","Manali","Solan","Mandi","Kullu","Hamirpur","Una","Bilaspur","Chamba","Kangra","Kinnaur","Lahaul","Spiti","Sirmaur","Kasauli","Palampur","Nahan","Baddi","Nalagarh","Paonta Sahib","Nurpur","Dalhousie","Keylong","Kaza","Reckong Peo","Rampur","Sundernagar","Jogindernagar","Bhuntar","Banjar","Anni","Nichar","Sarahan","Rohru","Chopal","Theog","Jubbal","Kotkhai","Kumarsain","Narkanda","Baghi","Arki","Kandaghat","Dharampur","Rajgarh","Sangrah","Shillai","Pachhad","Renuka","Dadahu","Haripurdhar"]
},

"Jharkhand": {
  avgLST:38, risk:"HIGH",
  ndvi:0.38, ndbi:0.34, ndwi:-0.06, aqi:145,
  coastal:false,
  cities:["Ranchi","Jamshedpur","Dhanbad","Bokaro","Deoghar","Hazaribagh","Giridih","Ramgarh","Medininagar","Chatra","Gumla","Simdega","Lohardaga","Khunti","Saraikela","West Singhbhum","East Singhbhum","Dumka","Jamtara","Sahibganj","Pakur","Godda","Koderma","Latehar","Garhwa","Palamu","Chaibasa","Chakradharpur","Baharagora","Ghatsila","Musabani","Jadugoda","Noamundi","Kiriburu","Meghahatuburu","Sindri","Nirsa","Katras","Jharia","Kenduadih","Govindpur","Topchanchi","Gomoh","Phusro","Chas","Bermo","Petarbar","Bundu","Tamar","Silli","Angara","Nagri"]
},

"Karnataka": {
  avgLST:36, risk:"HIGH",
  ndvi:0.38, ndbi:0.32, ndwi:-0.04, aqi:110,
  coastal:true,
  cities:["Bengaluru","Mysuru","Mangaluru","Hubli","Belagavi","Davangere","Ballari","Vijayapura","Shivamogga","Tumkuru","Raichur","Bidar","Gulbarga","Dharwad","Hospet","Gadag","Bagalkot","Hassan","Chitradurga","Mandya","Udupi","Chikkamagaluru","Kolar","Ramanagara","Chamarajanagar","Kodagu","Yadgir","Koppal","Haveri","Uttara Kannada","Karwar","Sirsi","Dandeli","Honnavar","Kumta","Bhatkal","Kundapura","Manipal","Puttur","Sullia","Madikeri","Virajpet","Kushalnagar","Sringeri","Sagara","Soraba","Shiralakoppa","Bhadravati","Tarikere","Kadur","Birur","Tiptur","Arsikere","Belur","Halebidu","Sakleshpur","Alur","Holenarasipur","Channarayapatna","Nagamangala","Malavalli","Srirangapatna","Nanjangud","Gundlupet","Kollegal","Yelandur","Doddaballapur","Chikkaballapur","Gauribidanur","Bangarpet","Robertsonpet","Srinivaspur","Mulbagal","Sidlaghatta","Chintamani"]
},

"Kerala": {
  avgLST:33, risk:"MODERATE",
  ndvi:0.55, ndbi:0.18, ndwi:0.12, aqi:75,
  coastal:true,
  cities:["Thiruvananthapuram","Kochi","Kozhikode","Thrissur","Kollam","Kannur","Alappuzha","Palakkad","Malappuram","Kottayam","Irinjalakuda","Kayamkulam","Vatakara","Kanhangad","Thalassery","Ponnani","Chalakudy","Changanassery","Punalur","Tirur","Manjeri","Perinthalmanna","Nedumangad","Varkala","Paravur","Karunagappally","Pathanamthitta","Thiruvalla","Adoor","Pandalam","Mavelikara","Cherthala","Aroor","Vaikom","Ettumanoor","Pala","Thodupuzha","Kattappana","Idukki","Munnar","Devikulam","Udumbanchola","Mananthavady","Sultan Bathery","Kalpetta","Payyannur","Mattannur","Thalipparamba","Nileshwar","Kasaragod","Manjeshwar","Perambra","Quilandy","Feroke","Ramanattukara","Tanur","Kuttippuram","Pattambi","Shoranur","Ottappalam","Mannarkkad","Wandoor"]
},

"Madhya Pradesh": {
  avgLST:43, risk:"EXTREME",
  ndvi:0.25, ndbi:0.40, ndwi:-0.11, aqi:155,
  coastal:false,
  cities:["Bhopal","Indore","Gwalior","Jabalpur","Ujjain","Sagar","Dewas","Satna","Ratlam","Rewa","Murwara","Singrauli","Burhanpur","Khandwa","Bhind","Chhindwara","Vidisha","Chhatarpur","Damoh","Mandsaur","Khargone","Neemuch","Pithampur","Narmadapuram","Itarsi","Sehore","Hoshangabad","Seoni","Mandla","Dindori","Anuppur","Shahdol","Umaria","Katni","Panna","Tikamgarh","Ashoknagar","Guna","Shivpuri","Datia","Morena","Sheopur","Rajgarh","Betul","Harda","Balaghat","Narsinghpur","Raisen","Shajapur","Agar Malwa","Alirajpur","Barwani","Dhar","Jhabua","Mhow","Sanawad","Maheshwar","Mandleshwar","Bareli","Gadarwara","Gotegaon","Kareli","Nainpur","Waraseoni","Lakhnadon","Ghansour","Barghat","Chhapara","Saunsar","Amarwara","Pandhurna","Multai"]
},

"Maharashtra": {
  avgLST:39, risk:"HIGH",
  ndvi:0.28, ndbi:0.38, ndwi:-0.08, aqi:160,
  coastal:true,
  cities:["Mumbai","Pune","Nagpur","Nashik","Aurangabad","Solapur","Amravati","Kolhapur","Nanded","Sangli","Malegaon","Jalgaon","Akola","Latur","Dhule","Ahmednagar","Chandrapur","Parbhani","Ichalkaranji","Jalna","Ambarnath","Bhiwandi","Shirdi","Satara","Ratnagiri","Yavatmal","Achalpur","Osmanabad","Nandurbar","Wardha","Buldhana","Hingoli","Washim","Gadchiroli","Gondia","Bhandara","Thane","Vasai Virar","Kalyan Dombivali","Mira Bhayandar","Navi Mumbai","Ulhasnagar","Panvel","Khopoli","Lonavala","Khandala","Mahabaleshwar","Panchgani","Alibag","Roha","Murud","Shrivardhan","Mahad","Chiplun","Khed","Dapoli","Guhagar","Velneshwar","Sindhudurg","Malvan","Sawantwadi","Kudal","Vengurla","Banda","Shiroda","Dodamarg","Kolad","Igatpuri","Ghoti","Sinnar","Niphad","Manmad","Nandgaon","Kopargaon","Sangamner","Shrirampur","Rahuri","Pathardi","Shevgaon","Nevasa","Jamkhed","Karjat","Baramati","Indapur","Pandharpur","Mangalvedhe","Barshi","Akalkot","Tuljapur","Mukheda"]
},

"Manipur": {
  avgLST:28, risk:"MODERATE",
  ndvi:0.62, ndbi:0.12, ndwi:0.18, aqi:45,
  coastal:false,
  cities:["Imphal","Thoubal","Bishnupur","Churachandpur","Senapati","Ukhrul","Chandel","Tamenglong","Jiribam","Kakching","Kangpokpi","Pherzawl","Noney","Tengnoupal","Kamjong","Moreh","Lilong","Nambol","Wangoi","Moirang","Ningthoukhong","Kumbi","Yairipok","Heirok","Wangjing","Khangabok","Kakching Khunou","Sugnu","Pallel","Keirenglok","Nungba","Tamei","Tadubi","Saitu","Mao","Maram","Paomata","Karong","Kangchup","Litan"]
},

"Meghalaya": {
  avgLST:25, risk:"COOL",
  ndvi:0.68, ndbi:0.10, ndwi:0.22, aqi:40,
  coastal:false,
  cities:["Shillong","Tura","Jowai","Nongstoin","Baghmara","Williamnagar","Resubelpara","Ampati","Mawkyrwat","Mairang","Nongpoh","Byrnihat","Cherrapunji","Mawsynram","Dawki","Pynursla","Mawlai","Laitumkhrah","Nongthymmai","Pynthorumkhrah","Mawngap","Ranikor","Mahendraganj","Phulbari","Rajabala","Betasing","Mendipathar","Kharkutta","Nengkhra","Rongjeng","Dadenggre","Chokpot","Bali","Nongtalang","Khliehriat","Amlarem","Muktapur","Shella","Padu","Mawphlang","Mylliem"]
},

"Mizoram": {
  avgLST:27, risk:"COOL",
  ndvi:0.66, ndbi:0.09, ndwi:0.21, aqi:38,
  coastal:false,
  cities:["Aizawl","Lunglei","Champhai","Serchhip","Kolasib","Mamit","Lawngtlai","Saiha","Saitual","Khawzawl","Hnahthial","Siaha","Thenzawl","Vairengte","Bairabi","Darlawn","Khawhai","Tlabung","Lungsen","Bungtlang","Sangau","Chawngte","Tuipang","Phura","Zawlnuam","Zokhawthar","Chhimtuipui","East Lungdar","North Vanlaiphai","Bualpui"]
},

"Nagaland": {
  avgLST:27, risk:"COOL",
  ndvi:0.65, ndbi:0.10, ndwi:0.20, aqi:40,
  coastal:false,
  cities:["Kohima","Dimapur","Mokokchung","Wokha","Zunheboto","Tuensang","Mon","Phek","Kiphire","Longleng","Peren","Tseminyu","Noklak","Shamator","Tizit","Chumukedima","Niuland","Chümoukedima","Bhandari","Jalukie","Pughoboto","Suruhuto","Akuluto","Aghunato","Akuhaito","Satakha","Ghaspani","Medziphema","Zubza","Seithekema","Chiephobozou","Khermahal","Pfutsero","Meluri","Chozuba","Kivito","Tening","Nsong"]
},

"Odisha": {
  avgLST:41, risk:"HIGH",
  ndvi:0.38, ndbi:0.33, ndwi:-0.04, aqi:120,
  coastal:true,
  cities:["Bhubaneswar","Cuttack","Rourkela","Berhampur","Sambalpur","Puri","Balasore","Bhadrak","Baripada","Jharsuguda","Bargarh","Angul","Dhenkanal","Keonjhar","Kendrapara","Jeypore","Rayagada","Koraput","Nabarangpur","Kalahandi","Phulbani","Bolangir","Sonepur","Titilagarh","Bhawanipatna","Paralakhemundi","Gunupur","Sundargarh","Talcher","Jajpur","Jajpur Road","Kalinganagar","Paradip","Chandikhol","Kendujhar","Anandapur","Champua","Barbil","Udala","Karanjia","Jashipur","Rairangpur","Betnoti","Bangriposi","Subarnapur","Kantabanji","Titlagarh","Patnagarh","Kesinga","Muribahal","Boudh","Kantamal","Balliguda","Chatrapur","Digapahandi","Chhatrapur","Ganjam","Aska","Bhanjanagar","Polasara","Kabisuryanagar"]
},

"Punjab": {
  avgLST:44, risk:"HIGH",
  ndvi:0.35, ndbi:0.36, ndwi:-0.07, aqi:165,
  coastal:false,
  cities:["Ludhiana","Amritsar","Jalandhar","Patiala","Bathinda","Mohali","Hoshiarpur","Gurdaspur","Pathankot","Fatehgarh Sahib","Moga","Firozpur","Kapurthala","Ropar","Sangrur","Muktsar","Barnala","Faridkot","Fazilka","Mansa","Nawanshahr","Tarn Taran","Phagwara","Khanna","Morinda","Sirhind","Abohar","Malout","Gidderbaha","Zira","Rampura Phul","Bagha Purana","Jagraon","Samrala","Gobindgarh","Rajpura","Dera Bassi","Zirakpur","Kharar","Anandpur Sahib","Nangal","Rupnagar","Chamkaur Sahib","Bassi Pathana","Fatehgarh Churian","Dera Baba Nanak","Qadian","Batala","Sujanpur","Dinanagar","Dhariwal","Mukerian","Dasuya","Mehatpur"]
},

"Rajasthan": {
  avgLST:48, risk:"EXTREME",
  ndvi:0.12, ndbi:0.51, ndwi:-0.18, aqi:180,
  coastal:false,
  cities:["Jaipur","Jodhpur","Udaipur","Kota","Bikaner","Ajmer","Bharatpur","Alwar","Bhilwara","Sri Ganganagar","Sikar","Pali","Tonk","Barmer","Jaisalmer","Churu","Jhunjhunu","Nagaur","Jhalawar","Baran","Dungarpur","Banswara","Chittorgarh","Sawai Madhopur","Dausa","Hanumangarh","Karauli","Dholpur","Rajsamand","Sirohi","Pratapgarh","Jalor","Bundi","Kishangarh","Beawar","Gangapur City","Hindaun","Makrana","Sujangarh","Sardarshahar","Nokha","Deshnoke","Kolayat","Phalodi","Balotra","Pachpadra","Sanchore","Raniwara","Sumerpur","Falna","Jalore","Bhinmal","Sheogarh","Bagidora","Sagwara","Chorasi","Aspur","Simalwara","Mandal","Shahpura","Todaraisingh","Niwai","Malpura","Deoli","Kekri","Nasirabad","Pushkar","Marwar Junction","Ras","Sojat","Desuri","Jaitaran","Piplia","Nimaj","Shergarh","Bhopalgarh"]
},

"Sikkim": {
  avgLST:20, risk:"COOL",
  ndvi:0.72, ndbi:0.07, ndwi:0.28, aqi:30,
  coastal:false,
  cities:["Gangtok","Namchi","Mangan","Gyalshing","Ravangla","Pelling","Yuksom","Jorethang","Nayabazar","Rangpo","Singtam","Rongli","Pakyong","Rhenock","Temi","Dentam","Hee Bermoik","Kaluk","Sombaria","Uttarey","Tashiding","Khecheopalri","Pemayangste","Legship","Daramdin","Soreng","Chakung","Lachen","Lachung","Chungthang","Dikchu","Singhik","Phensang","Phodong","Rumtek","Ranka","Martam","Aritar","Padamchen","Lingtam","Chujachen","Zuluk"]
},

"Tamil Nadu": {
  avgLST:38, risk:"HIGH",
  ndvi:0.32, ndbi:0.34, ndwi:-0.06, aqi:125,
  coastal:true,
  cities:["Chennai","Coimbatore","Madurai","Tiruchirappalli","Salem","Tirunelveli","Tiruppur","Ranipet","Nagercoil","Thanjavur","Dindigul","Vellore","Cuddalore","Kanchipuram","Erode","Hosur","Kumbakonam","Karur","Udhagamandalam","Ariyalur","Thoothukudi","Pudukkottai","Nagapattinam","Sivaganga","Virudhunagar","Theni","Ramanathapuram","Villupuram","Kallakurichi","Tiruvannamalai","Krishnagiri","Dharmapuri","Namakkal","Perambalur","Nilgiris","Tenkasi","Chengalpattu","Tirupattur","Mayiladuthurai","Kanniyakumari","Maduranthakam","Cheyyar","Arani","Ambur","Vaniyambadi","Gudiyatham","Arcot","Sholingur","Polur","Tirukkoyilur","Ulundurpet","Sankarapuram","Gingee","Tindivanam","Vandavasi","Sriperumbudur","Tiruvallur","Gummidipoondi","Ponneri","Thiruvottiyur","Ambattur","Avadi","Tambaram","Pallavaram","Chromepet","Perungalathur","Kundrathur","Poonamallee","Uthiramerur","Maraimalai Nagar","Oragadam","Srirangam","Lalgudi","Musiri","Thuraiyur","Jayankondam","Papanasam","Mayavaram","Sirkazhi","Chidambaram","Panruti","Neyveli","Virudhachalam","Tittagudi"]
},

"Telangana": {
  avgLST:43, risk:"HIGH",
  ndvi:0.22, ndbi:0.41, ndwi:-0.13, aqi:148,
  coastal:false,
  cities:["Hyderabad","Warangal","Nizamabad","Karimnagar","Khammam","Nalgonda","Ramagundam","Mahabubnagar","Adilabad","Suryapet","Miryalaguda","Siddipet","Bodhan","Nirmal","Mancherial","Asifabad","Bhongir","Vikarabad","Wanaparthy","Gadwal","Narayanpet","Jogulamba","Nagarkurnool","Medak","Sangareddy","Zaheerabad","Sadasivpet","Tandur","Shadnagar","Mahbubnagar","Jadcherla","Achampet","Kollapur","Kalwakurthy","Devarakonda","Kodad","Huzurnagar","Alair","Jangaon","Narsampet","Mahabubabad","Mulugu","Bhadrachalam","Kothagudem","Palvancha","Yellandu","Paloncha","Burgampadu","Pinapaka","Dummugudem","Aswaraopeta","Sathupally","Madhira","Wyra","Nellikuduru","Chandrugonda","Thirumalayapalem","Peddapalli","Manthani","Jagtial","Korutla","Metpally","Dharmapuri","Armur","Banswada","Kamareddy","Yellareddy","Bichkunda"]
},

"Tripura": {
  avgLST:32, risk:"MODERATE",
  ndvi:0.55, ndbi:0.18, ndwi:0.10, aqi:70,
  coastal:false,
  cities:["Agartala","Udaipur","Dharmanagar","Kailashahar","Belonia","Ambassa","Sabroom","Amarpur","Khowai","Sonamura","Bishalgarh","Melaghar","Mohanpur","Jirania","Majlishpur","Teliamura","Kamalpur","Kumarghat","Panisagar","Kanchanpur","Damcherra","Pencharthal","Jubarajnagar","Manu","Gandacherra","Raishyabari","Bagbasa","Rajnagar","Ompi","Salema","Karbook","Longtharai Valley","Boxanagar","Jampuijala","Bishramganj","Nalchar","Santirbazar","Hrishyamukh"]
},

"Uttar Pradesh": {
  avgLST:47, risk:"EXTREME",
  ndvi:0.22, ndbi:0.42, ndwi:-0.12, aqi:210,
  coastal:false,
  cities:["Lucknow","Kanpur","Agra","Varanasi","Prayagraj","Meerut","Ghaziabad","Noida","Mathura","Moradabad","Bareilly","Aligarh","Gorakhpur","Saharanpur","Firozabad","Muzaffarnagar","Jhansi","Rampur","Shahjahanpur","Hapur","Unnao","Bahraich","Hardoi","Ballia","Sitapur","Ayodhya","Sultanpur","Gonda","Etawah","Budaun","Azamgarh","Jaunpur","Mirzapur","Bijnor","Amroha","Bulandshahr","Etah","Mainpuri","Farrukhabad","Banda","Fatehpur","Raebareli","Pratapgarh","Ghazipur","Deoria","Basti","Ambedkar Nagar","Barabanki","Rae Bareli","Amethi","Chitrakoot","Hamirpur","Lalitpur","Mahoba","Lakhimpur Kheri","Pilibhit","Chandauli","Sant Kabir Nagar","Maharajganj","Kushinagar","Siddharth Nagar","Shravasti","Balrampur","Kanpur Dehat","Kanpur Nagar","Auraiya","Kannauj","Kasganj","Sambhal","Hathras","Baghpat","Shamli","Gautam Buddha Nagar","Orai","Jalaun","Kaushambi","Allahabad","Siddharthnagar","Mau","Sant Ravidas Nagar","Sonbhadra"]
},

"Uttarakhand": {
  avgLST:29, risk:"MODERATE",
  ndvi:0.58, ndbi:0.15, ndwi:0.15, aqi:60,
  coastal:false,
  cities:["Dehradun","Haridwar","Rishikesh","Nainital","Roorkee","Haldwani","Rudrapur","Kashipur","Ramnagar","Mussoorie","Kotdwar","Tehri","Pauri","Srinagar","Lansdowne","Almora","Bageshwar","Chamoli","Gopeshwar","Joshimath","Pithoragarh","Uttarkashi","Barkot","Purola","Mori","Karnaprayag","Nandprayag","Rudraprayag","Ukhimath","Augustmuni","Agastyamuni","Tilwara","Satpuli","Dwarahat","Ranikhet","Chaukori","Munsiari","Dharchula","Didihat","Gangolihat","Berinag","Champawat","Tanakpur","Lohaghat","Bazpur","Jaspur","Kichha","Sitarganj","Khatima","Gadarpur","Dineshpur","Nagla","Laksar","Manglaur","Bhagwanpur","Jwalapur","Landhaura","Doiwala","Vikas Nagar","Chakrata"]
},

"West Bengal": {
  avgLST:38, risk:"HIGH",
  ndvi:0.35, ndbi:0.35, ndwi:-0.05, aqi:145,
  coastal:true,
  cities:["Kolkata","Howrah","Asansol","Siliguri","Durgapur","Bardhaman","Malda","Baharampur","Habra","Kharagpur","Shantipur","Dankuni","Dhulian","Ranaghat","Haldia","Raiganj","Krishnanagar","Nabadwip","Medinipur","Jalpaiguri","Balurghat","Basirhat","Bankura","Chakdaha","Darjeeling","Alipurduar","Cooch Behar","Purulia","Bolpur","Suri","Bishnupur","Arambagh","Tamluk","Contai","Baruipur","Diamond Harbour","Kalyani","Nadia","Bongaon","Barasat","Dum Dum","Barrackpore","Titagarh","Naihati","Budge Budge","Maheshtala","Uluberia","Bagnan","Amta","Udaynarayanpur","Champadanga","Pursurah","Goghat","Khanakul","Dhaniakhali","Pandua","Polba","Haripal","Singur","Chanditala","Uttarpara","Serampore","Rishra","Konnagar","Champdany","Bhadreswar","Chandannagar","Hooghly","Chinsurah","Bandel","Tribeni","Magra","Jamalpur","Memari","Katwa","Kalna","Monteswar","Purbasthali","Nadanghat","Burdwan","Galsi","Ausgram","Raina","Khandaghosh","Bhatar"]
},

"Jammu and Kashmir": {
  avgLST:24, risk:"MODERATE",
  ndvi:0.52, ndbi:0.19, ndwi:0.17, aqi:55,
  coastal:false,
  cities:["Jammu","Kathua","Udhampur","Rajouri","Poonch","Doda","Kishtwar","Ramban","Reasi","Samba","Bishnah","Arnia","Suchetgarh","Marh","Akhnoor","Khour","Pargwal","Nowshera","Sunderbani","Kalakote","Budhal","Thannamandi","Darhal","Manjakote","Gambhir Singh Pura","Behrote","Mendhar","Surankote","Haveli","Ramnagar","Chenani","Nathatop","Nagrota","Batote","Patnitop","Kud","Srinagar","Anantnag","Baramulla","Sopore","Pulwama","Shopian","Kulgam","Bandipora","Ganderbal","Budgam","Kupwara","Handwara","Uri","Gurez","Lolab","Langate","Kreeri","Pattan","Tangmarg","Gulmarg","Pahalgam","Kokernag","Dooru","Achabal","Bijbehara","Qazigund","Banihal"]
},

"Ladakh": {
  avgLST:18, risk:"COOL",
  ndvi:0.15, ndbi:0.08, ndwi:0.05, aqi:30,
  coastal:false,
  cities:["Leh","Kargil","Nubra","Zanskar","Drass","Diskit","Hunder","Panamik","Turtuk","Tyakshi","Bogdang","Chalunkha","Partapur","Khalsar","Sumur","Panamic","Warshi","Shyok","Durbuk","Tangtse","Chushul","Nyoma","Hanle","Korzok","Tso Moriri","Mahe","Puga","Sarchu","Pang","Debring","Rumtse","Gya","Mhe","Upshi","Thiksey","Hemis","Shey","Stok","Choglamsar","Phyang","Nimoo","Khalatse","Saspol","Alchi","Rizong","Likir","Basgo","Nimmu","Suru","Sankoo","Panikhar","Parkachik","Rangdum","Padum","Karsha","Zangla","Purne","Ating","Raru","Hamling"]
},

"Delhi": {
  avgLST:46, risk:"EXTREME",
  ndvi:0.18, ndbi:0.48, ndwi:-0.15, aqi:250,
  coastal:false,
  cities:["New Delhi","Dwarka","Rohini","Noida","Gurugram","Faridabad","Shahdara","Janakpuri","Vasant Kunj","Saket","Lajpat Nagar","Defence Colony","Karol Bagh","Connaught Place","Chandni Chowk","Civil Lines","Model Town","Pitampura","Shalimar Bagh","Wazirabad","Narela","Bawana","Mundka","Uttam Nagar","Vikaspuri","Paschim Vihar","Punjabi Bagh","Mayur Vihar","Patparganj","Preet Vihar","Laxmi Nagar","Vivek Vihar","Geeta Colony","Dilshad Garden","Anand Vihar","Karkarduma","Krishna Nagar","Gandhi Nagar","Ashok Vihar","Lawrence Road","Tri Nagar","Swaroop Nagar","Saraswati Vihar","Mangolpuri","Sultanpuri","Budh Vihar","Peeragarhi","Nangloi","Nilothi","Khyala","Moti Nagar","Tagore Garden","Subhash Nagar","Tilak Nagar","Hari Nagar","Bindapur","Dabri","Palam","Mahipalpur","Bijwasan","Najafgarh","Dichaon Kalan","Kapashera","Aya Nagar","Mandi","Mehrauli","Chhatarpur","Tughlakabad","Badarpur","Sangam Vihar","Govindpuri","Kalkaji","Nehru Place","Okhla","Jasola","Sarita Vihar","Madanpur Khadar","Jaitpur","Mithapur","Ghitorni","Sultanpur","Gadaipur","Rangpuri","Vasant Gaon","Munirka","RK Puram","Safdarjung Enclave","Green Park","Hauz Khas","Malviya Nagar","Pushp Vihar","Sheikh Sarai","Chirag Dilli","Neb Sarai","Lado Sarai","Khirki","Begumpur","Satbari"]
},

"Chandigarh": {
  avgLST:40, risk:"HIGH",
  ndvi:0.30, ndbi:0.35, ndwi:-0.05, aqi:150,
  coastal:false,
  cities:["Chandigarh","Manimajra","Burail","Dhanas","Mauli Jagran","Hallomajra","Raipur Kalan","Behlana","Sarangpur","Kaimbwala","Palsora","Daria","Maloya","Bapu Dham","Rock Garden","Sector 17","Sector 22","Sector 35","Industrial Area Phase 1","Industrial Area Phase 2","IT Park","Mohali","Panchkula","Zirakpur"]
},

"Puducherry": {
  avgLST:36, risk:"HIGH",
  ndvi:0.32, ndbi:0.30, ndwi:0.05, aqi:90,
  coastal:true,
  cities:["Puducherry","Karaikal","Mahe","Yanam","Ozhukarai","Ariyankuppam","Bahour","Mannadipet","Nettapakkam","Villianur","Thirunallar","Thirubuvanai","Mudaliarpet","Lawspet","Muthialpet","White Town","Orleanpet","Reddiarpalayam","Kuyavarpalayam","Sedarapet"]
},

"Andaman and Nicobar Islands": {
  avgLST:30, risk:"MODERATE",
  ndvi:0.65, ndbi:0.10, ndwi:0.20, aqi:40,
  coastal:true,
  cities:["Port Blair","Diglipur","Neil Island","Havelock Island","Mayabunder","Rangat","Baratang","Bamboo Flat","Garacharma","Prothrapur","Wimberlygunj","Ferrargunj","Wandoor","Chidiyatapu","Manjeri","Little Andaman","Car Nicobar","Nancowry","Kamorta","Katchal","Teressa","Chowra","Trinkat","Camorta","Great Nicobar","Indira Point","Campbell Bay","Joginder Nagar"]
},

"Lakshadweep": {
  avgLST:28, risk:"COOL",
  ndvi:0.60, ndbi:0.10, ndwi:0.30, aqi:35,
  coastal:true,
  cities:["Kavaratti","Agatti","Amini","Androth","Minicoy","Chetlat","Kadmat","Kalpeni","Kiltan","Bitra","Bangaram","Suheli Par","Cheriyam","Pitti","Valiyakara"]
},

"Dadra and Nagar Haveli and Daman and Diu": {
  avgLST:38, risk:"HIGH",
  ndvi:0.30, ndbi:0.28, ndwi:0.05, aqi:100,
  coastal:true,
  cities:["Silvassa","Daman","Diu","Amli","Naroli","Khanvel","Dunetha","Samarvarni","Rakholi","Dadra","Masat","Falandi","Saily","Athal","Bedkuva","Kawant","Vapi","Bhimpore","Nani Daman","Moti Daman","Nagoa","Vanakbara","Ghoghla","Fudam","Bucharwada","Zari","Morkhal","Sisodra"]
},

} // end STATE_DATA

const INDIA_DATA = Object.fromEntries(
  Object.entries(STATE_DATA).map(([state, data]) => [
    state,
    {
      ...data,
      heatIndex: data.heatIndex ?? data.avgLST ?? 30
    }
  ])
)

const leaderBase = [
  { city: 'Jaisalmer', temp: 49, flag: '🔴', state: 'Rajasthan' },
  { city: 'Bikaner', temp: 48, flag: '🔴', state: 'Rajasthan' },
  { city: 'Delhi', temp: 46, flag: '🔴', state: 'Delhi' },
  { city: 'Ahmedabad', temp: 45, flag: '🔴', state: 'Gujarat' },
  { city: 'Nagpur', temp: 44, flag: '🟠', state: 'Maharashtra' },
]

// CITY lookup helpers will be created inside the App component using useMemo



function getStateName(geo) {
  if(!geo || !geo.properties) return null
  return geo.properties.NAME_1 || geo.properties.name || geo.properties.NAME || geo.properties.ST_NAME || geo.properties.state || geo.properties.STATE || null
}

function resolveName(raw) {
  if(!raw) return null
  const s = String(raw).trim()
  if(STATE_DATA[s]) return s
  const lower = s.toLowerCase()
  // common variants
  const aliases = {
    'orissa': 'Odisha',
    'odisha': 'Odisha',
    'andaman & nicobar': 'Andaman and Nicobar Islands',
    'andaman and nicobar islands': 'Andaman and Nicobar Islands',
    'jammu & kashmir': 'Jammu and Kashmir',
    'uttar pradesh': 'Uttar Pradesh',
    'west bengal': 'West Bengal',
    'andhra pradesh': 'Andhra Pradesh',
    'telangana': 'Telangana',
    'ladakh': 'Ladakh',
    'delhi': 'Delhi',
    'uttarakhand': 'Uttarakhand',
    'uttaranchal': 'Uttarakhand',
    'himachal pradesh': 'Himachal Pradesh',
    'chandigarh': 'Chandigarh',
    'puducherry': 'Puducherry'
  }
  if(aliases[lower]) return aliases[lower]
  // try fuzzy match
  for(const key of Object.keys(STATE_DATA)){
    if(key.toLowerCase() === lower) return key
    if(key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) return key
  }
  return s
}

function getHeatColor(name) {
  if(!name) return '#0d1f3c'
  const risk = STATE_DATA[name]?.risk
  const m = {
    EXTREME: '#b91c1c',
    HIGH: '#c2410c',
    MODERATE: '#ca8a04',
    COOL: '#15803d'
  }
  return m[risk] || '#444'
}

function getAdjustedLST(name){
  return STATE_DATA[name]?.avgLST ?? 30
}

function formatClock(date){
  if(!date) date = new Date()
  const hh = date.getHours()
  const mm = String(date.getMinutes()).padStart(2,'0')
  const ss = String(date.getSeconds()).padStart(2,'0')
  const hour12 = ((hh + 11) % 12) + 1
  const ampm = hh >= 12 ? 'PM' : 'AM'
  const time = `${hour12}:${mm}:${ss} ${ampm}`
  const period = hh < 6 ? 'Night' : hh < 12 ? 'Morning' : hh < 18 ? 'Afternoon' : 'Evening'
  return { time, period }
}

function getTimeOffset(hour) {
  if (hour >= 6 && hour < 12) return -1.5
  if (hour >= 12 && hour < 18) return 0.6
  if (hour >= 18 && hour < 22) return -1.2
  return -2.4
}

function getRiskBadgeColor(risk){
  const map = {
    // Legacy hardcoded STATE_DATA risk labels (pre-cache fallback)
    EXTREME: {bg:'#b91c1c', text:'#fff'},
    HIGH: {bg:'#c2410c', text:'#fff'},
    MODERATE: {bg:'#ca8a04', text:'#0f172a'},
    COOL: {bg:'#15803d', text:'#fff'},
    // Bucket labels from getRiskLabel(liveHeatIndex) — the live-derived path
    'VERY HIGH': {bg:'#c2410c', text:'#fff'},
    'LOW-MODERATE': {bg:'#4d7c0f', text:'#fff'},
    'LOW': {bg:'#15803d', text:'#fff'}
  }
  return map[risk] || {bg:'#444', text:'#fff'}
}

function submitSignIn(name, email, password){
  // very small validation for demo
  // Name is optional for signin
  if(!email || !password) return false
  return true
}

function getRiskBg(risk) {
  const m = {
    EXTREME: "#b91c1c",
    HIGH: "#c2410c",
    MODERATE: "#ca8a04",
    COOL: "#15803d"
  }
  return m[risk] || "#444"
}

function getAQIColor(aqi) {
  if (aqi > 300) return "#dc2626"
  if (aqi > 200) return "#ea580c"
  if (aqi > 100) return "#eab308"
  return "#22c55e"
}

function getRiskText(risk) {
  return (risk === 'MODERATE' || risk === 'LOW-MODERATE') ? '#222' : '#fff'
}

const INDIC_FONT_STACK = "'Inter', 'Noto Sans Devanagari', 'Noto Sans Bengali', 'Noto Sans Tamil', 'Noto Sans Telugu', 'Noto Sans Gujarati', 'Noto Sans Kannada', 'Noto Sans Oriya', 'Noto Sans Gurmukhi', 'Noto Nastaliq Urdu', sans-serif"

// Custom-rendered dropdown, NOT a native <select>/<option> — native option popups use the
// browser/OS's own background+text colors for the open list (ignoring this app's dark theme
// entirely on most platforms), which is why language names were unreadable (light gray text
// on the OS's near-white popup background) even after the font-rendering fix. A plain div-based
// list gives full control over both font AND contrast for every script, independent of any
// browser/OS native-widget quirks.
function LanguageDropdown() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const current = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) || SUPPORTED_LANGUAGES[0]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'rgba(255,255,255,0.05)', color: '#cbd5e1',
          border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4,
          fontSize: 10, fontWeight: 700, padding: '5px 8px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5, fontFamily: INDIC_FONT_STACK,
          whiteSpace: 'nowrap'
        }}
      >
        {current.label} <span style={{ fontSize: 8, opacity: 0.7 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          background: '#0f1729', border: '1px solid #1a2a4a', borderRadius: 8,
          minWidth: 190, maxHeight: 320, overflowY: 'auto', zIndex: 2000,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
        }}>
          {SUPPORTED_LANGUAGES.map(lang => (
            <div
              key={lang.code}
              onClick={() => { changeLanguage(lang.code); setOpen(false) }}
              style={{
                padding: '9px 14px', cursor: 'pointer', fontSize: 13, fontFamily: INDIC_FONT_STACK,
                color: lang.code === current.code ? '#d97706' : '#e2e8f0',
                background: lang.code === current.code ? 'rgba(217,119,6,0.1)' : 'transparent',
                borderBottom: '1px solid rgba(255,255,255,0.06)'
              }}
              onMouseEnter={e => { if (lang.code !== current.code) e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
              onMouseLeave={e => { if (lang.code !== current.code) e.currentTarget.style.background = 'transparent' }}
            >
              {lang.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// One consistent "where is this data coming from" line for every panel that reads the
// bulk live-weather cache: loading → unavailable (baseline values) → outdated → live.
function CacheStatusNote({ status, lastUpdated, isStale, formatAgo, onRetry, liveText = 'Live', marginBottom = 8, suffix = null }) {
  const { t } = useTranslation()
  const base = { fontSize: 9, marginBottom, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }
  const retryBtn = onRetry ? (
    <button
      type="button"
      onClick={onRetry}
      style={{ background: 'transparent', border: '1px solid rgba(217,119,6,0.5)', color: '#d97706', borderRadius: 4, padding: '1px 6px', fontSize: 9, cursor: 'pointer' }}
    >
      🔄 {t('common.retry', 'Retry')}
    </button>
  ) : null
  if (status === 'loading') {
    return <div style={{ ...base, color: 'rgba(255,255,255,0.45)' }}>⏳ {t('panels.loadingLive', 'Loading live data…')}</div>
  }
  if (status === 'error') {
    return (
      <div style={{ ...base, color: '#eab308' }}>
        ⚠️ {t('panels.liveUnavailable', 'Live data unavailable — showing baseline values.')} {retryBtn}
      </div>
    )
  }
  if (!lastUpdated) return null
  if (isStale(lastUpdated)) {
    return (
      <div style={{ ...base, color: '#eab308' }}>
        🟠 {t('panels.dataOutdated', 'Data may be outdated')} · last refresh {formatAgo(lastUpdated)}
      </div>
    )
  }
  return (
    <div style={{ ...base, color: 'rgba(255,255,255,0.35)' }}>
      📡 {liveText} · updated {formatAgo(lastUpdated)}{suffix}
    </div>
  )
}

function CityPanel({ stateName, stateData, onCitySelect, selectedCity, onAnalyze, liveCache, liveSelectedTemp, cacheLastUpdated, stateRefreshedAt = null, cacheStatus, onRetryCache, formatAgo, isCacheStale }) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  
  // ✅ FIX: Reset search when stateName changes (switch states)
  useEffect(() => {
    setSearch("")
  }, [stateName])
  
  const cities = stateData?.cities || []
  const filtered = cities.filter(c =>
    c.toLowerCase()
      .includes(search.toLowerCase())
  )

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{
        fontSize: 11,
        color: "#d97706",
        fontWeight: 700,
        borderLeft: "3px solid #d97706",
        paddingLeft: 8,
        marginBottom: 10
      }}>
        {t('panels.selectCity', 'SELECT CITY')} - {stateName?.toUpperCase()}
        <span style={{
          color: "rgba(255,255,255,0.4)",
          fontWeight: 400,
          marginLeft: 6
        }}>
          ({cities.length} cities)
        </span>
      </div>

      <CacheStatusNote
        status={cacheStatus}
        lastUpdated={stateRefreshedAt || cacheLastUpdated}
        isStale={stateRefreshedAt ? () => false : isCacheStale}
        formatAgo={formatAgo}
        onRetry={onRetryCache}
        liveText={stateRefreshedAt ? `Live temps · ${stateName} refreshed` : 'Live temps'}
        suffix={(stateRefreshedAt ? ` (daily cache from ${formatAgo(cacheLastUpdated)} for the rest of India)` : '') + ' · "NO LIVE DATA" = city not in the weather cache yet (nothing is estimated)'}
      />

      <div style={{
        position: "relative",
        marginBottom: 8
      }}>
        <span style={{
          position: "absolute",
          left: 10,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: 13,
          pointerEvents: "none"
        }}>🔍</span>
        <input
          type="text"
          placeholder={t('nav.searchCityPlaceholder', 'Search city...')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: "100%",
            background: "#0a0e1a",
            border: "1px solid #1a2a4a",
            borderRadius: 8,
            color: "#ffffff",
            padding: "9px 12px 9px 32px",
            fontSize: 12,
            outline: "none",
            boxSizing: "border-box"
          }}
          onFocus={e => {
            e.target.style.borderColor = "#d97706"
            e.target.style.boxShadow =
              "0 0 0 2px rgba(217,119,6,0.2)"
          }}
          onBlur={e => {
            e.target.style.borderColor = "#1a2a4a"
            e.target.style.boxShadow = "none"
          }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.4)",
              cursor: "pointer",
              fontSize: 14,
              padding: 2
            }}
          >✕</button>
        )}
      </div>

      {search && (
        <div style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.4)",
          marginBottom: 6,
          paddingLeft: 4
        }}>
          {t('cityList.showingOf', 'Showing {{shown}} of {{total}}', { shown: filtered.length, total: cities.length })}
        </div>
      )}

      <div style={{
        maxHeight: 220,
        overflowY: "auto",
        border: "1px solid #1a2a4a",
        borderRadius: 10,
        background: "#080c18",
        scrollbarWidth: "thin",
        scrollbarColor: "#334155 #0a0e1a"
      }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: "20px",
            textAlign: "center",
            color: "rgba(255,255,255,0.3)",
            fontSize: 12
          }}>
            {t('cityList.noResultsFor', 'No cities found for "{{search}}"', { search })}
          </div>
        ) : (
          filtered.map((city, idx) => {
            const isSelected = city === selectedCity
            const liveEntry = liveCache?.[`${city}|${stateName}`]
            const liveTemp = isSelected && typeof liveSelectedTemp === 'number'
              ? liveSelectedTemp
              : liveEntry?.temp
            const isLive = typeof liveTemp === 'number'
            // Fresh = refreshed for this state in the last 15 min (or the selected city's own live fetch)
            const observedMs = liveEntry?.observedAt ? new Date(liveEntry.observedAt).getTime() : 0
            const isFresh = (isSelected && typeof liveSelectedTemp === 'number') || (Date.now() - observedMs < 15 * 60 * 1000)
            // No fabricated fallback. The old "~estimate" (state avgLST ± a hash of the
            // city name) was a made-up number that could sit 7°C off reality, e.g.
            // Sundernagar showing ~21.8°C on a 29°C day. A city that is not in the live
            // cache says so instead.
            const lst = isLive ? liveTemp.toFixed(1) : null

            return (
              <div
                key={city}
                onClick={() => onCitySelect(city)}
                style={{
                  padding: "10px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  background: isSelected
                    ? "rgba(217,119,6,0.12)"
                    : "transparent",
                  borderBottom: idx < filtered.length-1
                    ? "1px solid rgba(255,255,255,0.05)"
                    : "none",
                  transition: "background 0.15s",
                  borderLeft: isSelected
                    ? "3px solid #d97706"
                    : "3px solid transparent"
                }}
                onMouseEnter={e => {
                  if(!isSelected)
                    e.currentTarget.style.background
                      = "rgba(255,255,255,0.04)"
                }}
                onMouseLeave={e => {
                  if(!isSelected)
                    e.currentTarget.style.background
                      = "transparent"
                }}
              >
                <div>
                  <div style={{
                    fontSize: 13,
                    fontWeight: isSelected ? 700 : 400,
                    color: isSelected
                      ? "#d97706" : "#ffffff"
                  }}>
                    {city}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.35)",
                    marginTop: 1
                  }}>
                    {stateName}
                  </div>
                </div>

                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}>
                  {isLive ? (
                    <span
                      title={isFresh ? t('cityList.freshTitle', 'Live reading from the last few minutes') : t('cityList.cachedTitle', 'From the daily cache — opens live when refreshed')}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: getThemeAccent(liveTemp),
                        transition: 'color 0.4s ease',
                        display: 'inline-flex', alignItems: 'center', gap: 5
                      }}
                    >
                      {isFresh && <span data-testid="fresh-dot" style={{ width: 6, height: 6, borderRadius: 3, background: '#22c55e', boxShadow: '0 0 6px #22c55e', display: 'inline-block' }} />}
                      {lst}°C
                    </span>
                  ) : (
                    <span
                      data-testid="no-live-data"
                      title={t('cityList.noLiveDataTitle', 'No live reading for this city yet — it is not in the weather cache. Nothing is estimated.')}
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        color: 'rgba(255,255,255,0.45)',
                        border: '1px solid rgba(255,255,255,0.14)',
                        borderRadius: 4,
                        padding: '1px 5px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {t('cityList.noLiveData', 'NO LIVE DATA')}
                    </span>
                  )}
                  {isSelected && (
                    <span style={{
                      fontSize: 9,
                      background: "#d97706",
                      color: "#0f172a",
                      borderRadius: 4,
                      padding: "1px 5px",
                      fontWeight: 700
                    }}>
                      SELECTED
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {selectedCity && (
        <button
          onClick={() => onAnalyze?.()}
          style={{
            width: "100%",
            marginTop: 10,
            padding: "12px",
            background: "#d97706",
            border: "none",
            borderRadius: 10,
            color: "#0f172a",
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "opacity 0.2s, transform 0.2s"
          }}
          onMouseEnter={e => {
            e.currentTarget.style.opacity = "0.9"
            e.currentTarget.style.transform = "scale(1.02)"
          }}
          onMouseLeave={e => {
            e.currentTarget.style.opacity = "1"
            e.currentTarget.style.transform = "scale(1)"
          }}
        >
          🔥 {t('nav.analyze', 'Analyze')} {selectedCity}
        </button>
      )}

      {!selectedCity && (
        <div style={{
          marginTop: 8,
          textAlign: "center",
          fontSize: 11,
          color: "rgba(255,255,255,0.3)"
        }}>
          {t('tooltips.clickCityToAnalyze', 'Click any city above to analyze')}
        </div>
      )}
    </div>
  )
}

// Complete state name mapping for GeoJSON variants to INDIA_DATA keys
const STATE_NAME_MAP = {
  // Exact matches and common GeoJSON variants
  'Andhra Pradesh': 'Andhra Pradesh',
  'Arunachal Pradesh': 'Arunachal Pradesh',
  'Arunanchal Pradesh': 'Arunachal Pradesh',
  'Assam': 'Assam',
  'Bihar': 'Bihar',
  'Chhattisgarh': 'Chhattisgarh',
  'Chattisgarh': 'Chhattisgarh',
  'Chhatisgarh': 'Chhattisgarh',
  'Goa': 'Goa',
  'Gujarat': 'Gujarat',
  'Haryana': 'Haryana',
  'Himachal Pradesh': 'Himachal Pradesh',
  'Jharkhand': 'Jharkhand',
  'Jharkand': 'Jharkhand',
  'Karnataka': 'Karnataka',
  'Kerala': 'Kerala',
  'Madhya Pradesh': 'Madhya Pradesh',
  'Maharashtra': 'Maharashtra',
  'Manipur': 'Manipur',
  'Meghalaya': 'Meghalaya',
  'Mizoram': 'Mizoram',
  'Nagaland': 'Nagaland',
  'Odisha': 'Odisha',
  'Orissa': 'Odisha',
  'Punjab': 'Punjab',
  'Rajasthan': 'Rajasthan',
  'Sikkim': 'Sikkim',
  'Tamil Nadu': 'Tamil Nadu',
  'Tamilnadu': 'Tamil Nadu',
  'Telangana': 'Telangana',
  'Tripura': 'Tripura',
  'Uttar Pradesh': 'Uttar Pradesh',
  'Uttarakhand': 'Uttarakhand',
  'Uttaranchal': 'Uttarakhand',
  'Uttrakhand': 'Uttarakhand',
  'West Bengal': 'West Bengal',
  // Union Territories - all variants
  'Andaman & Nicobar Island': 'Andaman and Nicobar Islands',
  'Andaman and Nicobar Island': 'Andaman and Nicobar Islands',
  'Andaman & Nicobar Islands': 'Andaman and Nicobar Islands',
  'Andaman and Nicobar Islands': 'Andaman and Nicobar Islands',
  'Chandigarh': 'Chandigarh',
  'Dadra & Nagar Haveli': 'Dadra and Nagar Haveli and Daman and Diu',
  'Dadra and Nagar Haveli': 'Dadra and Nagar Haveli and Daman and Diu',
  'Dadara & Nagar Havelli': 'Dadra and Nagar Haveli and Daman and Diu',
  'Daman & Diu': 'Dadra and Nagar Haveli and Daman and Diu',
  'Daman and Diu': 'Dadra and Nagar Haveli and Daman and Diu',
  'Dadra and Nagar Haveli and Daman and Diu': 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi': 'Delhi',
  'NCT of Delhi': 'Delhi',
  'Jammu & Kashmir': 'Jammu and Kashmir',
  'Jammu and Kashmir': 'Jammu and Kashmir',
  'Jammu': 'Jammu and Kashmir',
  'Kashmir': 'Jammu and Kashmir',
  'Ladakh': 'Ladakh',
  'Lakshadweep': 'Lakshadweep',
  'Lakshwadeep': 'Lakshadweep',
  'Puducherry': 'Puducherry',
  'Pondicherry': 'Puducherry',
  'Puduchery': 'Puducherry',
}

function fixStateName(raw) {
  if (!raw) return ''
  const trimmed = raw.trim()

  // 1. Direct lookup in map
  if (STATE_NAME_MAP[trimmed]) return STATE_NAME_MAP[trimmed]

  // 2. Direct match in INDIA_DATA
  if (INDIA_DATA[trimmed]) return trimmed

  // 3. Case-insensitive match against INDIA_DATA keys
  const lc = trimmed.toLowerCase()
  const found = Object.keys(INDIA_DATA).find(k => k.toLowerCase() === lc)
  if (found) return found

  // 4. Case-insensitive match against STATE_NAME_MAP keys
  const found2 = Object.keys(STATE_NAME_MAP).find(k => k.toLowerCase() === lc)
  if (found2) return STATE_NAME_MAP[found2]

  // 5. Partial match fallback
  const partial = Object.keys(INDIA_DATA).find(k =>
    k.toLowerCase().includes(lc) || lc.includes(k.toLowerCase())
  )
  if (partial) return partial

  console.warn('STATE NOT MATCHED:', raw)
  return trimmed
}

const STATES_URL = '/data/india_states_full.geojson'
const DISTRICTS_URL = '/data/india_districts_full.geojson'
const JK_URL = '/data/jk_ladakh_official.geojson'
// scale 1120 / centre 23.2°N: India fills ~93% of the 800×600 map box (was 83% at
// scale 1000, with the extra slack sitting under Kanyakumari because 22.5°N is south of
// India's Mercator mid-latitude). Kashmir, Arunachal and the A&N / Lakshadweep labels
// stay inside the box — checked at scale 1120; anything larger clips the top.
const INDIA_MAP_PROJECTION_CONFIG = { scale: 1120, center: [82.8, 23.2] }
// One shared d3 projection for every map layer (react-simple-maps accepts a projection
// function directly). translate = half of ComposableMap's default 800x600 viewBox, i.e. what
// the library computed from the config above. precision(0) turns off d3-geo's adaptive
// resampling: by default it subdivides every border segment into great-circle steps, which
// a CPU profile showed to be the bulk of the projection work (linePoint/mercatorRaw) — and
// it grew as the geometry was simplified, since longer segments get more subdivisions.
// At this map size Mercator straight segments are visually identical.
const INDIA_MAP_PROJECTION = geoMercator()
  .translate([400, 300])
  .scale(INDIA_MAP_PROJECTION_CONFIG.scale)
  .center(INDIA_MAP_PROJECTION_CONFIG.center)
  .precision(0)

// STATES_URL (~23MB) and JK_URL are each used by TWO separate map layers
// (fill + border). Without this cache, react-simple-maps' <Geographies> fetches
// and JSON-parses the same large file twice per layer pair, which was a real
// contributor to the slow/"stuck" map load. One shared in-flight-promise cache
// per URL means every layer reuses the same fetch+parse instead of redoing it.
const geoDataCache = new Map()
// The simplified files are 0.1–0.4 MB (scripts/simplifyGeo.sh); the timeout stays generous — but it is a real
// timeout: a stalled CDN no longer leaves the map spinner up forever.
const GEO_FETCH_TIMEOUT_MS = 90000
function loadGeoData(url) {
  let cached = geoDataCache.get(url)
  if (!cached) {
    cached = fetchJson(url, { timeoutMs: GEO_FETCH_TIMEOUT_MS }).catch(err => {
      // Drop the failed promise so the next mount / Retry actually refetches.
      // (Previously the rejected promise was cached forever, so a single failed
      // load meant "Loading map data…" for the rest of the session.)
      geoDataCache.delete(url)
      throw err
    })
    geoDataCache.set(url, cached)
  }
  return cached
}
function useGeoData(url) {
  const [state, setState] = useState({ data: null, error: null })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setState(prev => (prev.error ? { data: prev.data, error: null } : prev))
    loadGeoData(url).then(
      json => { if (active) setState({ data: json, error: null }) },
      err => { if (active) setState({ data: null, error: err }) }
    )
    return () => { active = false }
  }, [url, attempt])
  const retry = useCallback(() => setAttempt(a => a + 1), [])
  return { data: state.data, error: state.error, retry }
}
const INDIA_MAP_LAYER_STYLE = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }

function smoothRing(coords, iterations = 1) {
  if (!Array.isArray(coords) || coords.length < 4) return coords

  let smoothed = coords
  for (let i = 0; i < iterations; i += 1) {
    smoothed = smoothed.map((point, index) => {
      const prev = smoothed[(index - 1 + smoothed.length) % smoothed.length]
      const next = smoothed[(index + 1) % smoothed.length]
      return [
        (prev[0] + point[0] * 2 + next[0]) / 4,
        (prev[1] + point[1] * 2 + next[1]) / 4
      ]
    })

    if (
      smoothed.length > 0 &&
      (smoothed[0][0] !== smoothed[smoothed.length - 1][0] ||
        smoothed[0][1] !== smoothed[smoothed.length - 1][1])
    ) {
      smoothed = [...smoothed, smoothed[0]]
    }
// The simplified files are 0.1–0.4 MB (scripts/simplifyGeo.sh); the timeout stays generous — but it is a real
// timeout: a stalled CDN no longer leaves the map spinner up forever.
const GEO_FETCH_TIMEOUT_MS = 90000
function loadGeoData(url) {
  let cached = geoDataCache.get(url)
  if (!cached) {
    cached = fetchJson(url, { timeoutMs: GEO_FETCH_TIMEOUT_MS }).catch(err => {
      // Drop the failed promise so the next mount / Retry actually refetches.
      // (Previously the rejected promise was cached forever, so a single failed
      // load meant "Loading map data…" for the rest of the session.)
      geoDataCache.delete(url)
      throw err
    })
    geoDataCache.set(url, cached)
  }
  return cached
}
  }
  return smoothed
}

function smoothGeometry(geometry) {
  if (!geometry || !geometry.type || !geometry.coordinates) return geometry

  const smoothPolygon = (polygon) => polygon.map((ring) => smoothRing(ring, 1))

  if (geometry.type === 'Polygon') {
    return { ...geometry, coordinates: smoothPolygon(geometry.coordinates) }
  }

  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) => smoothPolygon(polygon))
    }
  }

  return geometry
}

// Memoized per feature object: the states layers call this inside their render function,
// so without the cache every re-render (cache load, live sample, selection…) re-smoothed
// ~47k vertices per layer and handed react-simple-maps a brand-new geometry to re-project.
const smoothedFeatureCache = new WeakMap()
function smoothGeoFeature(feature) {
  if (!feature || !feature.geometry) return feature
  let out = smoothedFeatureCache.get(feature)
  if (!out) {
    out = { ...feature, geometry: smoothGeometry(feature.geometry) }
    smoothedFeatureCache.set(feature, out)
  }
  return out
}

// Single source of truth for heat-index color/risk buckets — used by getHeatIndexColor,
// getRiskLabel, and the map legend, so they can never drift out of sync with each other.
const HEAT_INDEX_BUCKETS = [
  { min: 45, color: '#b91c1c', label: 'EXTREME', legend: 'EXTREME 45+' },
  { min: 40, color: '#c2410c', label: 'VERY HIGH', legend: 'VERY HIGH 40-45' },
  { min: 35, color: '#b45309', label: 'HIGH', legend: 'HIGH 35-40' },
  { min: 30, color: '#ca8a04', label: 'MODERATE', legend: 'MODERATE 30-35' },
  { min: 25, color: '#4d7c0f', label: 'LOW-MODERATE', legend: 'LOW-MODERATE 25-30' },
  { min: -Infinity, color: '#15803d', label: 'LOW', legend: 'LOW <25' }
]

function getHeatIndexColor(heatIndex) {
  return HEAT_INDEX_BUCKETS.find(b => heatIndex >= b.min).color
}

function getRiskLabel(heatIndex) {
  return HEAT_INDEX_BUCKETS.find(b => heatIndex >= b.min).label
}

// Map colour rule (5 Sept 2026): a state is coloured by the risk category that the MOST of
// its cities are in — a plurality vote over HEAT_INDEX_BUCKETS — not by a single statistic.
// A median (used before) hides "what most of the state is in" once buckets are involved:
// half the cities at 29 °C and half at 31 °C is a coin-flip between two colours. Ties go to
// the more severe bucket (HEAT_INDEX_BUCKETS is ordered most → least severe and we only
// replace the leader on a strictly larger count), because a disaster-management map should
// never under-state risk on a tie. The median stays available as supporting detail.
function pluralityBucket(temps) {
  const counts = HEAT_INDEX_BUCKETS.map(b => ({ label: b.label, color: b.color, min: b.min, count: 0 }))
  for (const t of temps) {
    const i = HEAT_INDEX_BUCKETS.findIndex(b => t >= b.min)
    if (i >= 0) counts[i].count++
  }
  let best = null
  for (const c of counts) if (!best || c.count > best.count) best = c
  const total = temps.length
  return {
    bucket: best ? { label: best.label, color: best.color, min: best.min, count: best.count, share: total ? Math.round((best.count / total) * 100) : 0 } : null,
    counts: counts.map(c => ({ ...c, share: total ? Math.round((c.count / total) * 100) : 0 })),
    total
  }
}
// Colour / label for a state's map fill and badge: the plurality bucket when live city
// readings exist, else the bucket of whatever heat index the state carries.
function getStateRiskColor(data) {
  return data?.riskBucket?.color || getHeatIndexColor(typeof data?.heatIndex === 'number' ? data.heatIndex : 30)
}
function getStateRiskLabel(data) {
  return data?.riskBucket?.label || getRiskLabel(typeof data?.heatIndex === 'number' ? data.heatIndex : 30)
}

// Heat Risk Gauge geometry — was previously 4 hand-picked arc paths whose angular spans
// already summed to the full 180°, permanently hiding a 5th "base" green arc drawn
// underneath them, with a "needle" that was just a dot fixed at the pivot and never actually
// rotated. Rebuilt to derive both the arc segments AND the needle angle from
// HEAT_INDEX_BUCKETS — the same single source of truth as the map legend — so colors can't
// drift out of sync and segment widths reflect the real 5°C-wide buckets rather than being
// eyeballed. GAUGE_MIN/MAX give the two open-ended buckets (LOW <25, EXTREME 45+) a finite
// width to render; comfortably below the coolest (~18°C) and above the hottest (~48°C)
// avgLST values in STATE_DATA.
const GAUGE_MIN = 15
const GAUGE_MAX = 50
const GAUGE_CENTER = { x: 100, y: 100 }
const GAUGE_RADIUS = 80

function gaugeAngleDeg(value) {
  const clamped = Math.max(GAUGE_MIN, Math.min(GAUGE_MAX, value))
  return 180 - ((clamped - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN)) * 180
}

function gaugePoint(angleDeg, radius = GAUGE_RADIUS) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: GAUGE_CENTER.x + radius * Math.cos(rad),
    y: GAUGE_CENTER.y - radius * Math.sin(rad)
  }
}

// Six segments, one per HEAT_INDEX_BUCKETS entry, each spanning from its own min threshold
// to the next bucket's min (or GAUGE_MIN/MAX at the open ends) — so e.g. MODERATE 30-35
// genuinely occupies the angular fraction (35-30)/(GAUGE_MAX-GAUGE_MIN) of the arc, not a
// guessed pixel span.
const GAUGE_SEGMENTS = (() => {
  const ascending = [...HEAT_INDEX_BUCKETS].sort((a, b) => a.min - b.min)
  const boundaries = [GAUGE_MIN, ...ascending.slice(1).map(b => b.min), GAUGE_MAX]
  return ascending.map((bucket, i) => ({ color: bucket.color, from: boundaries[i], to: boundaries[i + 1] }))
})()

// UI "thermal" accent theme — 3 broad interface categories that drive card borders,
// glows, headings and button accents via CSS custom properties. Completely separate
// from HEAT_INDEX_BUCKETS above: the map's 6-bucket legend/fill colors are fixed
// data-meaning and must never change with this. This is a visual theme layer only.
// Four risk tiers, keyed off the SELECTED CITY's live current temperature (°C):
//   Extreme ≥ 45 → red · High 35–45 → orange · Moderate 25–35 → yellow · Low < 25 → green
const UI_THEME_BUCKETS = [
  { min: 45, label: 'Extreme', accent: '#dc2626', bgStart: '#221417', bgEnd: '#0f172a', glow: 'rgba(185,28,28,0.35)' },
  { min: 35, label: 'High', accent: '#ea580c', bgStart: '#23160f', bgEnd: '#0f172a', glow: 'rgba(194,65,12,0.35)' },
  { min: 25, label: 'Moderate', accent: '#eab308', bgStart: '#231f0f', bgEnd: '#0f172a', glow: 'rgba(202,138,4,0.35)' },
  { min: -Infinity, label: 'Low', accent: '#22c55e', bgStart: '#0f1f17', bgEnd: '#0f172a', glow: 'rgba(21,128,61,0.35)' }
]

// Single place every themed surface reads from — pass a heat value, get back the CSS
// custom properties to spread onto that subtree's wrapper style prop.
function getThemeVars(heat) {
  const safe = typeof heat === 'number' && !Number.isNaN(heat) ? heat : 30
  const bucket = UI_THEME_BUCKETS.find(b => safe >= b.min)
  return {
    '--theme-accent': bucket.accent,
    '--theme-bg-start': bucket.bgStart,
    '--theme-bg-end': bucket.bgEnd,
    '--theme-glow': bucket.glow
  }
}

function getThemeAccent(heat) {
  const safe = typeof heat === 'number' && !Number.isNaN(heat) ? heat : 30
  return UI_THEME_BUCKETS.find(b => safe >= b.min).accent
}

// Health & Safety Precautions — deterministic rules-based mapping from live current
// temperature (+ live AQI) to a precaution list. No AI call, loads instantly.
function getPrecautionInfo(temp, aqi) {
  if (typeof temp !== 'number') return null

  if (temp >= 38) {
    const category = temp >= 45 ? 'EXTREME' : 'HIGH'
    const items = [
      'Avoid outdoor activity 12pm–4pm',
      'Stay hydrated — drink water every 20-30 min even if not thirsty',
      'Watch for heat exhaustion signs (dizziness, nausea, rapid pulse)',
      'Wear light, loose, light-colored cotton clothing',
      'Use ORS/electrolytes if sweating heavily',
      'Keep elderly, children, outdoor workers under extra watch'
    ]
    if (typeof aqi === 'number' && aqi > 200) {
      items.push('AQI is also high — limit outdoor exposure further')
      items.push('Consider wearing an N95 mask outdoors')
    }
    return { category, groupKey: 'HOT', color: category === 'EXTREME' ? '#dc2626' : '#ea580c', items }
  }

  if (temp < 15) {
    return {
      category: 'COLD',
      groupKey: 'COLD',
      color: '#2563eb',
      items: [
        'Layer clothing, cover extremities (hands, ears, head)',
        'Watch for hypothermia signs in elderly/infants',
        'Avoid sudden cold-to-warm transitions',
        'Keep indoor heating/ventilation balanced (CO poisoning risk with unventilated heaters)',
        'Stay dry — wet clothing in cold accelerates heat loss'
      ]
    }
  }

  return {
    category: temp >= 32 ? 'MODERATE' : 'COOL',
    groupKey: 'MILD',
    color: '#15803d',
    items: [
      'General sun safety (sunscreen, hat, sunglasses)',
      'Stay hydrated',
      'No major restrictions needed'
    ]
  }
}

function getRawName(geo) {
  const p = geo.properties
  return (
    p.NAME_1 ||
    p.name ||
    p.NAME ||
    p.st_nm ||
    p.STATE ||
    p.statename ||
    p.State ||
    p.state ||
    p.STNAME ||
    ''
  )
}


// city/state pairs use STATE_DATA's actual city-list spelling (Delhi's own entry lists
// "New Delhi", not "Delhi", as its first city) so these map straight onto real keys.
const QUICK_PICK_CITIES = [
  { label: 'Delhi', city: 'New Delhi', state: 'Delhi' },
  { label: 'Mumbai', city: 'Mumbai', state: 'Maharashtra' },
  { label: 'Bengaluru', city: 'Bengaluru', state: 'Karnataka' },
  { label: 'Jaipur', city: 'Jaipur', state: 'Rajasthan' },
  { label: 'Chennai', city: 'Chennai', state: 'Tamil Nadu' },
  { label: 'Kolkata', city: 'Kolkata', state: 'West Bengal' }
]

// LAYER 1 extracted + memoized: this never reads hoveredState/tooltip, but living inline
// inside IndiaMap meant every hover-triggered re-render re-ran react-simple-maps' full
// Mercator projection (mercatorRaw/polygonContains/streamLine, etc.) for every district in
// the large districts GeoJSON — confirmed via CPU profile (43% of all sampled time during
// mouse movement, single re-renders blocking the main thread for 1-8+ seconds). Memoizing
// this with a prop list that excludes hover state stops that recomputation on every hover,
// without changing any boundary, color, or projection logic — output is byte-identical.
const DistrictsLayer = React.memo(function DistrictsLayer({ DATA }) {
  return (
    <ComposableMap
      projection={INDIA_MAP_PROJECTION}
      style={INDIA_MAP_LAYER_STYLE}
    >
      <GeographiesLayer
        url={DISTRICTS_URL}
        render={(geographies) =>
          geographies.map((geo) => {
            const p = geo.properties
            const rawState = p.NAME_1 || p.ST_NM || p.STATE || p.st_nm || ''
            const stateName = fixStateName(rawState, DATA)

            if (rawState && /jammu|kashmir|ladakh/i.test(stateName || rawState)) {
              return null
            }

            const heat = DATA?.[stateName]?.heatIndex || 30
            const color = getStateRiskColor(DATA?.[stateName]) || getHeatIndexColor(heat)
            if (!color || typeof color !== 'string') {
              console.warn('INVALID HEAT COLOR', heat, stateName)
            }
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                data-state={stateName}
                style={{
                  default: {
                    fill: color,
                    stroke: '#0a1628',
                    strokeWidth: 0.35,
                    outline: 'none',
                    pointerEvents: 'none',
                    transition: 'fill 0.4s ease'
                  },
                  hover: { fill: color, outline: 'none', transition: 'fill 0.4s ease' },
                  pressed: { fill: color, outline: 'none', transition: 'fill 0.4s ease' }
                }}
              />
            )
          })
        }
      />
    </ComposableMap>
  )
})

// LAYER 4: weather-condition BADGES. Each state whose live readings cross a threshold
// (dust: avg PM10 ≥ 400 · rain: avg rain chance ≥ 60% · heavy cloud: avg cloud cover ≥ 80%,
// computed in liveStateWeatherCondition from the existing cache — no new fetch) gets ONE
// small icon on a dark disc at its centroid. States with no active condition get nothing:
// clean, solid heat-index colour. Earlier versions painted the whole state (first a
// translucent tint, then stripes/dashes/dots); both hid the heat colour, and in the
// monsoon 26 of 36 states cross the cloud/rain threshold on an ordinary day, so most of
// India ended up textured. A badge carries the same information without the clutter.
const WEATHER_OVERLAY_ICONS = { dust: 'dust', rain: 'rain', cloud: 'cloud', clear: null }
// Vector glyphs, not emoji: an emoji inside SVG <text> depends on the OS having a colour
// emoji font that the browser is willing to use within SVG — on machines without one the
// backing disc rendered but the glyph did not ("white rings, no icon"). Paths render the
// same everywhere. Drawn in a 16×16 box centred on the marker (translate(-8,-8)).
const CLOUD_PATH = 'M4.6 12.6a3 3 0 0 1-.5-5.95A4.6 4.6 0 0 1 13 6.1a3.3 3.3 0 0 1-.6 6.5H4.6z'
function WeatherGlyph({ kind }) {
  if (kind === 'cloud') {
    return <path d={CLOUD_PATH} fill='#e2e8f0' transform='translate(-8,-8)' />
  }
  if (kind === 'rain') {
    return (
      <g transform='translate(-8,-8)'>
        <path d={CLOUD_PATH} fill='#cbd5e1' transform='translate(1.2,-2.2) scale(0.82)' />
        <g stroke='#60a5fa' strokeWidth={1.5} strokeLinecap='round'>
          <line x1={5.5} y1={11.2} x2={4.5} y2={14.2} />
          <line x1={8.5} y1={11.2} x2={7.5} y2={14.2} />
          <line x1={11.5} y1={11.2} x2={10.5} y2={14.2} />
        </g>
      </g>
    )
  }
  if (kind === 'dust') {
    return (
      <g transform='translate(-8,-8)' fill='none' stroke='#f59e0b' strokeWidth={1.5} strokeLinecap='round'>
        <path d='M2.5 5.2c2-1.6 3.8-1.6 5.5 0s3.5 1.6 5.5 0' />
        <path d='M2.5 8.5c2-1.6 3.8-1.6 5.5 0s3.5 1.6 5.5 0' />
        <path d='M2.5 11.8c2-1.6 3.8-1.6 5.5 0s3.5 1.6 5.5 0' />
      </g>
    )
  }
  return null
}
const WeatherOverlayIcons = React.memo(function WeatherOverlayIcons({ DATA, centroids }) {
  return (
    <ComposableMap
      projection={INDIA_MAP_PROJECTION}
      style={{ ...INDIA_MAP_LAYER_STYLE, pointerEvents: 'none' }}
    >
      {Object.entries(centroids || {}).map(([name, coords]) => {
        const kind = WEATHER_OVERLAY_ICONS[DATA?.[name]?.weatherCondition?.type]
        if (!kind || !coords) return null
        return (
          <Marker key={name + '_wxicon'} coordinates={coords}>
            <g data-wx-badge={kind} style={{ pointerEvents: 'none' }}>
              <circle r={10} fill='rgba(15,23,42,0.82)' stroke='rgba(226,232,240,0.6)' strokeWidth={0.8} />
              <WeatherGlyph kind={kind} />
            </g>
          </Marker>
        )
      })}
    </ComposableMap>
  )
})

// LAYER 2 extracted + memoized, same reasoning as DistrictsLayer above. The `isHov` check
// previously read from app-level hoveredState was redundant: react-simple-maps' Geography
// only applies its `hover:` style to the specific element actually under the cursor (its
// own internal per-element hover state), so by the time this element's hover style is
// showing, hoveredState===name is already guaranteed true. Dropping that redundant read
// removes the need for this layer to depend on hoveredState at all — onHoverEnter/Leave
// are stable callbacks (useCallback, empty deps) so this never re-renders on hover.
const StatesInteractiveLayer = React.memo(function StatesInteractiveLayer({ DATA, onStateClick, onHoverEnter, onHoverLeave, solidFill = false }) {
  return (
    <ComposableMap
      projection={INDIA_MAP_PROJECTION}
      style={INDIA_MAP_LAYER_STYLE}
    >
      <GeographiesLayer
        url={STATES_URL}
        render={(geographies) =>
          geographies.map((geo) => {
            const raw = getRawName(geo)
            const name = fixStateName(raw, DATA)

            // Skip J&K/Ladakh from standard GeoJSON - they're rendered from custom split GeoJSON
            if (/jammu|kashmir|ladakh/i.test(name || raw)) {
              return null
            }

            const heat = DATA?.[name]?.heatIndex || 30
            const color = getStateRiskColor(DATA?.[name]) || getHeatIndexColor(heat)
            // Normally transparent — the district layer underneath carries the heat colour.
            // In Lite mode that layer is skipped, so this one paints the state itself.
            const baseFill = solidFill ? color : 'rgba(0,0,0,0)'
            return (
              <Geography
                key={geo.rsmKey + '_state'}
                geography={geo}
                data-state={name}
                onClick={() => onStateClick(name)}
                onMouseEnter={() => onHoverEnter(name)}
                onMouseLeave={() => onHoverLeave()}
                style={{
                  default: {
                    fill: baseFill,
                    stroke: '#ffffff',
                    strokeWidth: 1.5,
                    strokeOpacity: 0,
                    outline: 'none',
                    cursor: 'pointer',
                    pointerEvents: 'auto'
                  },
                  hover: {
                    fill: `${color}55`,
                    stroke: '#ffffff',
                    strokeWidth: 1.5,
                    strokeOpacity: 0,
                    outline: 'none',
                    cursor: 'pointer',
                    pointerEvents: 'auto'
                  },
                  pressed: { fill: `${color}80`, stroke: '#ffffff', strokeWidth: 1.5, strokeOpacity: 0, outline: 'none', pointerEvents: 'auto' }
                }}
              />
            )
          })
        }
      />
    </ComposableMap>
  )
})

// LAYER 2.5 extracted + memoized — its `isHov` variable was already dead/unused (the J&K
// hover style was always a fixed color, never conditioned on it), so this is a pure
// extraction with no logic change at all.
const JKInteractiveLayer = React.memo(function JKInteractiveLayer({ DATA, onStateClick, onHoverEnter, onHoverLeave }) {
  return (
    <ComposableMap
      projection={INDIA_MAP_PROJECTION}
      style={{ ...INDIA_MAP_LAYER_STYLE, pointerEvents: 'none' }}
    >
      <GeographiesLayer
        url={JK_URL}
        render={(geographies) =>
          geographies
            .filter((geo) => /jammu|kashmir|ladakh/i.test(getRawName(geo)))
            .map((geo) => {
              const p = geo.properties
              const rawState = p.NAME_1 || p.ST_NM || p.STATE || p.st_nm || ''
              const stateName = fixStateName(rawState, DATA)

              const color = getStateRiskColor(DATA?.[stateName])
              return (
                <Geography
                  key={geo.rsmKey + '_jk'}
                  geography={smoothGeoFeature(geo)}
                  onClick={() => onStateClick(stateName)}
                  onMouseEnter={() => onHoverEnter(stateName)}
                  onMouseLeave={() => onHoverLeave()}
                  style={{
                    default: {
                      fill: color,
                      stroke: '#0a1628',
                      strokeWidth: 1.2,
                      outline: 'none',
                      cursor: 'pointer',
                      pointerEvents: 'auto'
                    },
                    hover: {
                      fill: `${color}aa`,
                      stroke: '#d97706',
                      outline: 'none',
                      cursor: 'pointer',
                      pointerEvents: 'auto'
                    },
                    pressed: { fill: `${color}80`, outline: 'none', pointerEvents: 'auto' }
                  }}
                />
              )
            })
        }
      />
    </ComposableMap>
  )
})

// LAYER 3 extracted + memoized — always renders the DEFAULT (white) border style; the
// hovered border's color/width is applied imperatively via registerBorderRef (see IndiaMap),
// not through this component re-rendering with hoveredState.
const StateBordersLayer = React.memo(function StateBordersLayer({ DATA, registerBorderRef }) {
  return (
    <ComposableMap
      projection={INDIA_MAP_PROJECTION}
      style={{ ...INDIA_MAP_LAYER_STYLE, pointerEvents: 'none' }}
    >
      <GeographiesLayer
        url={STATES_URL}
        render={(geographies) =>
          geographies.map((geo) => {
            const raw = getRawName(geo)
            const name = fixStateName(raw)

            // Skip J&K/Ladakh from standard GeoJSON - they're rendered from custom split GeoJSON
            if (/jammu|kashmir|ladakh/i.test(name || raw)) {
              return null
            }

            return (
              <Geography
                key={geo.rsmKey + '_border'}
                geography={geo}
                ref={(el) => registerBorderRef(name, el)}
                style={{
                  default: {
                    fill: 'none',
                    stroke: '#ffffff',
                    strokeWidth: 2.0,
                    strokeOpacity: 0.95,
                    outline: 'none',
                    pointerEvents: 'none'
                  },
                  hover: { fill: 'none', outline: 'none' },
                  pressed: { fill: 'none', outline: 'none' }
                }}
              />
            )
          })
        }
      />
    </ComposableMap>
  )
})

// LAYER 3.5 extracted + memoized, same approach as StateBordersLayer above.
const JKBordersLayer = React.memo(function JKBordersLayer({ DATA, registerBorderRef }) {
  return (
    <ComposableMap
      projection={INDIA_MAP_PROJECTION}
      style={{ ...INDIA_MAP_LAYER_STYLE, pointerEvents: 'none' }}
    >
      <GeographiesLayer
        url={JK_URL}
        render={(geographies) =>
          geographies
            .filter((geo) => /jammu|kashmir|ladakh/i.test(getRawName(geo)))
            .map((geo) => {
              const p = geo.properties
              const rawState = p.NAME_1 || p.ST_NM || p.STATE || p.st_nm || ''
              const stateName = fixStateName(rawState)
              return (
                <Geography
                  key={geo.rsmKey + '_jk_border'}
                  geography={smoothGeoFeature(geo)}
                  ref={(el) => registerBorderRef(stateName, el)}
                  style={{
                    default: {
                      fill: 'none',
                      stroke: '#ffffff',
                      strokeWidth: 2.0,
                      strokeOpacity: 0.95,
                      outline: 'none',
                      pointerEvents: 'none'
                    },
                    hover: { fill: 'none', outline: 'none' },
                    pressed: { fill: 'none', outline: 'none' }
                  }}
                />
              )
            })
        }
      />
    </ComposableMap>
  )
})

// forwardRef exposes the internal zoom/pan transform div so the parent can mutate its
// style.transform directly via ref during a drag gesture (bypassing React state entirely
// for that high-frequency path) — see the onMouseMove handler at the call site for why.
const IndiaMap = React.forwardRef(({ INDIA_DATA: propINDIA_DATA, onStateClick, plannerMarkers = [], onPlannerMarkerClick, scale = 1, pos = { x: 0, y: 0 }, isDragging = false, cacheStatus = 'ready', cacheStale = false, cacheAgeLabel = null, audience = 'authority', selectedState = null, lite = false }, transformRef) => {
  // Legend is collapsed by default so the map itself stays fully visible (it covered ~60% of the map on phones).
  const [legendOpen, setLegendOpen] = useState(false)
  const { t } = useTranslation()
  const [hoveredState, setHoveredState] = useState(null)
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, name: '' })
  const DATA = propINDIA_DATA || INDIA_DATA
  const activeName = tooltip.visible ? tooltip.name : hoveredState
  const activeData = activeName ? DATA?.[activeName] : null

  // Stable callback references (empty deps — setHoveredState/setTooltip are themselves
  // stable) so the memoized interactive layers below don't re-render just because IndiaMap
  // re-rendered for an unrelated reason.
  const handleHoverEnter = useCallback((name) => {
    setHoveredState(name)
    setTooltip({ visible: true, x: 0, y: 0, name })
  }, [])
  const handleHoverLeave = useCallback(() => {
    setHoveredState(null)
    setTooltip({ visible: false, x: 0, y: 0, name: '' })
  }, [])

  // DOM refs for each state/J&K border path (registered by StateBordersLayer/JKBordersLayer
  // below), so the hovered border's highlight can be applied by directly mutating style —
  // see the effect below — instead of passing hoveredState as a prop and forcing those
  // memoized layers to re-render and recompute their projections on every hover.
  const borderRefsMap = useRef(new Map())
  const registerBorderRef = useCallback((name, el) => {
    if (el) borderRefsMap.current.set(name, el)
    else borderRefsMap.current.delete(name)
  }, [])
  const prevHoveredBorderRef = useRef(null)
  useEffect(() => {
    const prev = prevHoveredBorderRef.current
    if (prev && prev !== hoveredState) {
      const prevEl = borderRefsMap.current.get(prev)
      if (prevEl) {
        prevEl.style.stroke = '#ffffff'
        prevEl.style.strokeWidth = '2.0'
      }
    }
    if (hoveredState) {
      const el = borderRefsMap.current.get(hoveredState)
      if (el) {
        el.style.stroke = '#d97706'
        el.style.strokeWidth = '2.8'
      }
    }
    prevHoveredBorderRef.current = hoveredState
  }, [hoveredState])

  // DISTRICTS_URL/STATES_URL are large (~35MB/~23MB) geojson files — fetch +
  // parse genuinely takes several seconds. Without this, the map area looks
  // blank/stuck during that window instead of visibly loading.
  const { data: districtsGeoData, error: districtsGeoError, retry: retryDistrictsGeo } = useGeoData(DISTRICTS_URL)
  const { data: statesGeoData, error: statesGeoError, retry: retryStatesGeo } = useGeoData(STATES_URL)
  // Reuses the same cached fetch the JK layers below already trigger (geoDataCache in
  // useGeoData dedupes by URL) — just also keeping the parsed data here, not only inside
  // those nested layers, so this component can compute centroids from it too.
  const { data: jkGeoData, error: jkGeoError, retry: retryJkGeo } = useGeoData(JK_URL)
  const districtsReady = !!districtsGeoData
  const statesReady = !!statesGeoData
  const mapDataError = districtsGeoError || statesGeoError || jkGeoError || null
  const mapDataLoading = !mapDataError && (!districtsReady || !statesReady)
  const retryMapData = () => { retryDistrictsGeo(); retryStatesGeo(); retryJkGeo() }

  // Per-state centroid, computed once from the actual GeoJSON geometry (d3-geo's
  // geoCentroid) rather than guessed/hardcoded coordinates — INDIA_DATA has no lat/lon
  // per state. Powers the weather-overlay icon markers below (WeatherOverlayIcons):
  // a tint alone couldn't visually distinguish "heavy cloud" (gray) from "active rain"
  // (blue) once blended over green/olive heat colors, so rain/dust also get an emoji
  // marker pinned at their state's true geometric center.
  // Two steps so the expensive part (geoCentroid over every state's coordinates) runs once
  // per GeoJSON load, not on every live-data change: previously DATA was in the deps and
  // the centroids were recomputed six times during a normal map load (visible in a CPU
  // profile as d3's centroidRingPoint).
  const rawCentroids = useMemo(() => {
    const out = {}
    if (statesGeoData?.features) {
      for (const geo of statesGeoData.features) {
        const raw = getRawName(geo)
        if (!raw || /jammu|kashmir|ladakh/i.test(raw)) continue
        try { out[raw] = geoCentroid(geo) } catch { /* skip malformed geometry */ }
      }
    }
    if (jkGeoData?.features) {
      for (const geo of jkGeoData.features) {
        const raw = getRawName(geo)
        if (!raw || !/jammu|kashmir|ladakh/i.test(raw)) continue
        try { out[raw] = geoCentroid(geo) } catch { /* skip malformed geometry */ }
      }
    }
    return out
  }, [statesGeoData, jkGeoData])
  const stateCentroids = useMemo(() => {
    const out = {}
    for (const [raw, c] of Object.entries(rawCentroids)) {
      const name = fixStateName(raw, DATA)
      if (!name || /jammu|kashmir|ladakh/i.test(name) && !/jammu|kashmir|ladakh/i.test(raw)) continue
      out[name] = c
    }
    return out
  }, [rawCentroids, DATA])

  // Heat values are a static dataset (not a live feed), so "loaded N ago" — tracked from
  // when this map actually finished loading in THIS session — is the honest framing,
  // rather than implying a live refresh that doesn't happen.
  const [loadedAt, setLoadedAt] = useState(null)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!mapDataLoading && !loadedAt) setLoadedAt(Date.now())
  }, [mapDataLoading, loadedAt])
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])
  const dataAgeLabel = (() => {
    if (!loadedAt) return null
    const mins = Math.max(0, Math.round((now - loadedAt) / 60000))
    if (mins < 1) return 'Heat data loaded just now'
    if (mins === 1) return 'Heat data loaded 1 min ago'
    return `Heat data loaded ${mins} min ago`
  })()

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Zoom/pan transform wraps ONLY the actual map layers below (district/state/border
          GeoJSON + markers) — NOT this outer wrapper — so the tooltip card and heat index
          legend (rendered as unscaled siblings further down) stay fixed-size screen overlays
          regardless of zoom level, instead of scaling along with the map like they used to
          when the parent applied this transform to the whole IndiaMap instance. */}
      <div
        ref={transformRef}
        style={{
          position: 'absolute', inset: 0,
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.1s ease'
        }}
      >
        {(mapDataLoading || mapDataError) && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 30,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, background: 'rgba(10,14,26,0.85)', padding: 16, textAlign: 'center'
          }}>
            {mapDataError ? (
              <>
                <div style={{ fontSize: 22 }}>⚠️</div>
                <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>Map data could not be loaded</div>
                <div style={{ color: '#94a3b8', fontSize: 11, maxWidth: 320 }}>{describeFetchError(mapDataError, 'the map')}</div>
                <button
                  type="button"
                  onClick={retryMapData}
                  style={{
                    marginTop: 4, background: 'rgba(217,119,6,0.12)', border: '1px solid rgba(217,119,6,0.5)',
                    color: '#d97706', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  🔄 Retry
                </button>
              </>
            ) : (
              <>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  border: '3px solid rgba(217,119,6,0.25)', borderTopColor: '#d97706',
                  animation: 'spin 0.9s linear infinite'
                }} />
                <div style={{ color: '#94a3b8', fontSize: 12 }}>
                  Loading map data…
                </div>
              </>
            )}
          </div>
        )}
        {/* LAYER 1: District texture colored by parent-state heat — extracted + memoized
            above (DistrictsLayer) so hover-state changes elsewhere on the map don't force
            this large GeoJSON layer to recompute its projection on every hover. */}
        {/* Lite mode: skip the 594-district texture (the heaviest projection on first paint);
            the state layer below still carries the heat colour. */}
        {!lite && <DistrictsLayer DATA={DATA} />}

      {/* Weather conditions: no full-state fill here any more — the icon badges (LAYER 4, WeatherOverlayIcons) carry it. */}

      {/* LAYER 1.6: weather-overlay icon markers (rain/dust) — see WeatherOverlayIcons above. */}
      {/* Condition icons show in BOTH views — small, unambiguous, no blending with heat colours */}
      {/* Citizen view: only the selected city's state gets a badge (its condition is also
          spelled out in the citizen strip); Authority view: every affected state. */}
      <WeatherOverlayIcons
        DATA={DATA}
        centroids={audience === 'citizen'
          ? (selectedState && stateCentroids?.[selectedState] ? { [selectedState]: stateCentroids[selectedState] } : {})
          : stateCentroids}
      />

      {/* LAYER 2 + 2.5: extracted + memoized above (StatesInteractiveLayer/JKInteractiveLayer)
          — click/hover detection no longer forces a recompute of these GeoJSON layers on
          every hover; only the small tooltip panel and border-highlight layers update. */}
      <StatesInteractiveLayer DATA={DATA} onStateClick={onStateClick} onHoverEnter={handleHoverEnter} onHoverLeave={handleHoverLeave} solidFill={lite} />
      <JKInteractiveLayer DATA={DATA} onStateClick={onStateClick} onHoverEnter={handleHoverEnter} onHoverLeave={handleHoverLeave} />

      {/* LAYER 3 + 3.5: extracted + memoized (StateBordersLayer/JKBordersLayer below).
          These can't use react-simple-maps' own per-element hover (pointerEvents:'none'
          so clicks/hover pass through to Layer 2 underneath), so they genuinely need to
          know hoveredState from outside — but re-rendering all ~36 border paths through
          React on every hover was the same expensive recompute as Layers 1/2. Instead,
          borders render ONCE (memoized on DATA only) and the highlighted one is updated by
          directly mutating its DOM node's stroke/strokeWidth via a ref (same pattern as
          CustomCursor.jsx's lag animation) — no re-render, no projection recomputation. */}
      <StateBordersLayer DATA={DATA} registerBorderRef={registerBorderRef} />
      <JKBordersLayer DATA={DATA} registerBorderRef={registerBorderRef} />

      {/* (A hard-coded "extreme heat hotspot" layer used to pulse over Delhi, Rajasthan,
          UP, Gujarat and Bihar regardless of the live data. Removed 5 Sept 2026: it was
          not a measurement, and its two SMIL animations kept the map repainting.) */}

      {/* LAYER 5: Active-state glowing cyan crosshair marker */}
      {activeName && activeData?.centroid && (
        <ComposableMap
          projection={INDIA_MAP_PROJECTION}
          style={{ ...INDIA_MAP_LAYER_STYLE, pointerEvents: 'none' }}
        >
          <Marker coordinates={activeData.centroid}>
            <circle r={12} fill='none' stroke='#22f6ff' strokeWidth={2.25} opacity={0.85}>
              <animate attributeName='r' values='8;16;8' dur='1.8s' repeatCount='indefinite' />
              <animate attributeName='opacity' values='0.9;0.45;0.9' dur='1.8s' repeatCount='indefinite' />
            </circle>
            <circle r={5} fill='#22f6ff' stroke='#ffffff' strokeWidth={1.5} />
          </Marker>
        </ComposableMap>
      )}

      {/* LAYER 5b: Smart Mitigation Planner — cities the current plan funds. Marker colour =
          the city's current risk band, label = projected before → after. */}
      {plannerMarkers.length > 0 && (
        <ComposableMap projection={INDIA_MAP_PROJECTION} style={{ ...INDIA_MAP_LAYER_STYLE, pointerEvents: 'none' }}>
          {plannerMarkers.map(m => (
            <Marker key={`plan_${m.city}`} coordinates={[m.lon, m.lat]}>
              <g data-planner-marker={m.city} style={{ pointerEvents: 'all', cursor: 'pointer' }} onClick={() => onPlannerMarkerClick?.(m.city)}>
                <circle r={9} fill="rgba(15,23,42,0.85)" stroke={m.color} strokeWidth={2.5} />
                <circle r={3} fill={m.color} />
                <text y={-13} fontSize={7} fill="#f8fafc" textAnchor="middle" fontFamily="monospace" style={{ paintOrder: 'stroke', stroke: '#0f172a', strokeWidth: 2 }}>{m.city} {m.before}→{m.after}</text>
              </g>
            </Marker>
          ))}
        </ComposableMap>
      )}

      {/* LAYER 6: Island labels */}
      <ComposableMap
        projection={INDIA_MAP_PROJECTION}
        style={{ ...INDIA_MAP_LAYER_STYLE, pointerEvents: 'none' }}
      >
        <Marker coordinates={[72.6, 10.5]}>
          <g style={{ cursor: 'pointer', pointerEvents: 'all' }} onClick={() => onStateClick('Lakshadweep')}>
            <text x={0} y={30} fontSize={7} fill='#e2e8f0' textAnchor='middle' fontFamily='monospace' style={{ pointerEvents: 'none' }}>
              Lakshadweep
            </text>
          </g>
        </Marker>
        <Marker coordinates={[93.0, 10.5]}>
          <g style={{ cursor: 'pointer', pointerEvents: 'all' }} onClick={() => onStateClick('Andaman and Nicobar Islands')}>
            <text x={0} y={34} fontSize={6.5} fill='#e2e8f0' textAnchor='middle' fontFamily='monospace' style={{ pointerEvents: 'none' }}>
              A&N Islands
            </text>
          </g>
        </Marker>
      </ComposableMap>
      </div>

      {/* TOOLTIP CARD — top-right glass panel — deliberately OUTSIDE the zoom/pan
          transform div above, so it stays a fixed-size screen overlay regardless of
          map zoom level (see comment at the top of this component's render). */}
      {tooltip.visible && activeData && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            minWidth: 190,
            background: 'rgba(10, 22, 40, 0.92)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            borderRadius: 10,
            padding: '12px 14px',
            color: '#e2e8f0',
            fontFamily: 'monospace',
            fontSize: 12,
            boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
            pointerEvents: 'none',
            zIndex: 20
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{tooltip.name}</div>
          <div style={{ marginBottom: 4 }}>
            🌡️ Heat Index: <strong>{activeData.heatIndex}°C</strong>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)' }}>
              {activeData.heatIndexLive
                ? (activeData.heatIndexVintage === 'sample'
                    ? `live median of ${activeData.liveCityCount} sampled cities (refreshed minutes ago; opening the state reads all of them)`
                    : activeData.heatIndexVintage === 'live'
                      ? `live median of ${activeData.liveCityCount} cities' current temps (half are hotter, half cooler)`
                      : `median of ${activeData.liveCityCount} cities from the daily cache`)
                : '(estimated — no live city data for this state yet)'}
            </div>
          </div>
          <div style={{ marginBottom: 4 }}>
            Risk:{' '}
            <span style={{ background: getStateRiskColor(activeData), padding: '1px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
              {getStateRiskLabel(activeData)}
            </span>
            {activeData.riskBucket && (
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                colour = most common category: {activeData.riskBucket.count} of {activeData.liveCityCount} cities are {activeData.riskBucket.label}
                {activeData.bucketCounts && ` · ${activeData.bucketCounts.filter(b => b.count > 0 && b.label !== activeData.riskBucket.label).map(b => `${b.count} ${b.label}`).join(' · ')}`}
              </div>
            )}
          </div>
          <div style={{ marginBottom: 4 }}>📍 Cities: <strong>{activeData.cities?.length || 0}</strong></div>
          <div style={{ color: '#d97706', fontSize: 11, marginTop: 6 }}>Click to explore cities →</div>
        </div>
      )}

      {/* HEAT INDEX LEGEND — bottom-left. maxWidth (see .map-heat-legend in
          App.css) guarantees the map keeps a real visible share of its own
          container on narrow screens — this card had no size cap at all
          before, so on a phone-width map container (already only ~58% of a
          375px screen) it could cover nearly the entire visible map. */}
      {/* Cache-status chip — the state colours, weather-overlay tints and marker icons on this
          map all come from the bulk live-weather cache, so the map says so when that cache is
          missing or older than 36h (same rule as CacheStatusNote / the ticker badge). */}
      {(cacheStatus !== 'ready' || cacheStale) && (
        <div style={{
          position: 'absolute', top: 60, left: 12, zIndex: 20,
          background: 'rgba(10, 22, 40, 0.9)', border: '1px solid rgba(234,179,8,0.45)', borderRadius: 6,
          padding: '4px 8px', color: cacheStatus === 'loading' ? '#94a3b8' : '#eab308',
          fontFamily: 'monospace', fontSize: 10, maxWidth: '70%'
        }}>
          {cacheStatus === 'loading'
            ? '⏳ Loading live cache…'
            : cacheStatus === 'error'
              ? '⚠️ Live cache unavailable · map shows baseline colours'
              : `🟠 Map colours from cache · last refresh ${cacheAgeLabel || 'unknown'}`}
        </div>
      )}
      {!legendOpen ? (
        <button
          type="button"
          onClick={() => setLegendOpen(true)}
          aria-label="Show heat index legend"
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            zIndex: 20,
            background: 'rgba(10, 22, 40, 0.9)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            padding: '6px 10px',
            color: '#e2e8f0',
            fontFamily: 'monospace',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.5,
            cursor: 'pointer'
          }}
        >
          <PanelIcon name="palette" size={13} color="currentColor" /> Legend
        </button>
      ) : (
      <div
        className="map-heat-legend"
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          background: 'rgba(10, 22, 40, 0.9)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 8,
          padding: '10px 12px',
          color: '#e2e8f0',
          fontFamily: 'monospace',
          fontSize: 11,
          zIndex: 20,
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
          <span style={{ fontWeight: 700, letterSpacing: 0.5 }}>HEAT INDEX</span>
          <button
            type="button"
            onClick={() => setLegendOpen(false)}
            aria-label="Hide heat index legend"
            style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4,
              color: '#94a3b8', fontFamily: 'monospace', fontSize: 10, lineHeight: 1,
              padding: '2px 5px', cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>
        {HEAT_INDEX_BUCKETS.map(b => (
          <LegendRow key={b.label} color={b.color} label={b.legend} />
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
            background: '#ffffff', border: '1.5px solid #0a0e1a', display: 'inline-block'
          }} />
          <span>{t('heatLegend.activeHeatwave', 'Active heatwave (major states)')}</span>
        </div>
        {/* Weather-overlay legend — explains the WeatherOverlayIcons badges above. Always
            shown (like the heatwave row above it) so it reads the same whether or not any
            state currently has an active overlay, rather than the legend shifting/appearing
            as conditions change. */}
        <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span>🌧️</span>
            <span>{t('heatLegend.activeRain', 'Active rain — 🌧️ badge at the state centre')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span>🌫️</span>
            <span>{t('heatLegend.dustStorm', 'Dust storm, high PM10 — 🌫️ badge at the state centre')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>☁️</span>
            <span>{t('heatLegend.heavyCloud', 'Heavy cloud cover — ☁️ badge at the state centre')}</span>
          </div>
        </div>
        {dataAgeLabel && (
          <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 10, color: '#64748b' }}>
            {dataAgeLabel}
          </div>
        )}
      </div>
      )}
    </div>
  )
})

function LegendRow({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          background: color,
          display: 'inline-block'
        }}
      />
      <span>{label}</span>
    </div>
  )
}

// Wraps the async geojson fetch pattern used by react-simple-maps' <Geographies>.
// Uses the shared useGeoData cache (instead of passing `url` straight to
// <Geographies>) so repeated layers sharing a URL don't refetch/reparse it.
//
// Renders in fixed-size chunks, one new chunk per animation frame, instead of handing the
// whole dataset to a single <Geographies> at once. A CDP CPU profile (sign-in -> map screen
// -> 15s of cursor movement) showed react-simple-maps' own path-projection math
// (useGeographies -> prepareFeatures -> path/mercatorRaw/polygonContains, all internal to
// the library, not any app code) consuming ~45 of ~75 profiled seconds in one continuous
// block right after the map appears. (Since 5 Sept 2026 the served files are simplified
// with mapshaper — scripts/simplifyGeo.sh — to ~15k district and ~7.5k state vertices, which
// cut that projection work about 5x; the chunking below still spreads what remains.)
// That's a single synchronous main-thread block long enough to make the cursor feel
// completely unresponsive for a real stretch of time, which survived every previous fix
// (timer isolation, theming, etc.) because none of those touched this — it isn't caused by
// re-renders or unstable props, it's the inherent one-time cost of projecting this much
// detailed geometry, paid all at once.
//
// Each chunk gets its OWN <Geographies> instance with a geography object created exactly
// once and cached in a ref — so a later chunk being added never causes an earlier chunk to
// recompute its already-projected paths (which a naive "grow one big slice" approach would
// do, multiplying total work rather than just spreading it out).
// Chunk size is per-URL, not a flat constant: the districts file has many cheap features
// (594 features), but the states file has very few, individually large ones (35 features,
// the coastline-heavy ones carrying most of the vertices) — a chunk size tuned for districts would
// still make each states chunk freeze for a long stretch. Smaller chunks were tried as a
// flat default (3) and made total time-to-fully-rendered WORSE, not better, since each
// chunk forces a full React re-render/commit and that fixed per-chunk overhead dominates at
// small sizes far more than the geometry math does — so districts gets a larger chunk to
// amortize that overhead, while states/J&K get a much smaller one to keep each individual
// chunk's heavier per-feature cost from blocking input for too long at once.
const GEO_CHUNK_SIZE_BY_URL = { [STATES_URL]: 2, [JK_URL]: 2, [DISTRICTS_URL]: 40 }
const GEO_CHUNK_SIZE_DEFAULT = 20
function GeographiesLayer({ url, render }) {
  const { data } = useGeoData(url)
  const chunkSize = GEO_CHUNK_SIZE_BY_URL[url] ?? GEO_CHUNK_SIZE_DEFAULT
  const totalFeatures = data?.features?.length ?? 0
  const [chunksRendered, setChunksRendered] = useState(1)
  const chunkCacheRef = useRef([])

  useEffect(() => {
    if (!data) return
    const totalChunks = Math.max(1, Math.ceil(totalFeatures / chunkSize))
    if (chunksRendered >= totalChunks) return
    const id = requestAnimationFrame(() => setChunksRendered(c => Math.min(totalChunks, c + 1)))
    return () => cancelAnimationFrame(id)
  }, [data, chunksRendered, totalFeatures, chunkSize])

  if (!data) return null

  while (chunkCacheRef.current.length < chunksRendered) {
    const i = chunkCacheRef.current.length
    const start = i * chunkSize
    const slice = data.features.slice(start, start + chunkSize)
    if (slice.length === 0) break
    chunkCacheRef.current.push({ ...data, features: slice })
  }

  return (
    <>
      {chunkCacheRef.current.map((chunkData, i) => (
        <Geographies key={i} geography={chunkData}>
          {({ geographies }) => render(geographies)}
        </Geographies>
      ))}
    </>
  )
}

// ════════ COMPACT NAVBAR COMPONENTS ════════

const UserAvatarMenu = ({ currentUser, isAdmin, setScreen, onLogout, audience = 'authority', onAudienceChange, lite = false, onLiteChange }) => {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          cursor: 'pointer',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${isAdmin ? 'rgba(234,179,8,0.35)' : 'rgba(217,119,6,0.3)'}`,
          borderRadius: 6, padding: '3px 8px', fontSize: 11
        }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: 3,
          background: isAdmin ? 'rgba(234,179,8,0.2)' : 'rgba(217,119,6,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: isAdmin ? '#eab308' : '#d97706'
        }}>
          {currentUser?.name?.charAt(0) || 'U'}
        </div>
        <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
          {currentUser?.name?.split(' ')[0] || 'User'}
        </span>
        <span style={{ color: '#64748b', fontSize: 9 }}>▾</span>
      </div>

      {open && (
        <>
          <div style={{
            position: 'fixed', inset: 0, zIndex: 40
          }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4,
            background: 'rgba(10,15,30,0.98)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
            minWidth: 200, zIndex: 50, boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{currentUser?.name}</div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{currentUser?.email}</div>
              <div style={{
                fontSize: 9, marginTop: 4, background: isAdmin ? 'rgba(234,179,8,0.15)' : 'rgba(217,119,6,0.15)',
                color: isAdmin ? '#eab308' : '#d97706', borderRadius: 4, padding: '2px 6px',
                width: 'fit-content'
              }}>
                {isAdmin ? 'ADMIN' : 'USER'}
              </div>
            </div>
            {[
              { icon: '👤', label: 'My Profile', fn: () => { setScreen?.('profile'); setOpen(false) } },
              { icon: '🏆', label: 'My Badges', fn: () => { setScreen?.('profile'); setOpen(false) } },
              // Discreet audience switch — deliberately here, not in the header
              { icon: '👁️', label: `View: ${audience === 'citizen' ? 'Citizen' : 'Authority'} ⚙️ · switch to ${audience === 'citizen' ? 'Authority' : 'Citizen'}`, fn: () => { onAudienceChange?.(audience === 'citizen' ? 'authority' : 'citizen'); setOpen(false) } },
              { icon: '⚡', label: `Lite mode: ${lite ? 'On' : 'Off'} · ${lite ? 'switch off' : 'for slower phones / connections'}`, fn: () => { onLiteChange?.(!lite); setOpen(false) } },
              ...(isAdmin ? [{ icon: '🛡️', label: 'Admin Panel', fn: () => { setScreen?.('admin'); setOpen(false) } }] : [])
            ].map(item => (
              <div
                key={item.label}
                onClick={item.fn}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                style={{
                  padding: '10px 14px', cursor: 'pointer', display: 'flex', gap: 8,
                  alignItems: 'center', fontSize: 11, color: '#cbd5e1', transition: 'all 0.15s'
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </div>
            ))}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '8px 0' }}>
              <div
                onClick={() => { onLogout?.(); setOpen(false) }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,80,80,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                style={{
                  padding: '10px 14px', cursor: 'pointer', display: 'flex', gap: 8,
                  alignItems: 'center', fontSize: 11, color: '#ff6666', transition: 'all 0.15s'
                }}
              >
                <span>🚪</span>
                Logout
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const TickerBar = ({ leaderBase, liveAqiAlert, liveStormWatch, liveMumbai, liveShimla, cacheStatus = 'ready', cacheStale = false, compact = false }) => {
  // The ticker's city temps come from the bulk cache, so the badge must say so
  // honestly: LIVE only when the cache loaded and is fresh.
  const badge = cacheStatus === 'error'
    ? { text: 'OFFLINE', color: '#94a3b8', pulse: false }
    : cacheStatus === 'loading'
      ? { text: 'LOADING', color: '#94a3b8', pulse: true }
      : cacheStale
        ? { text: 'CACHED', color: '#eab308', pulse: false }
        : { text: 'LIVE', color: '#86efac', pulse: true }
  const isCritical = (label, value) => {
    if (!value || value === 'Loading...' || value === '...') return false
    const valueStr = String(value).toLowerCase()

    if (label === 'AQI Alert') {
      const aqiMatch = valueStr.match(/(\d+)/)
      const aqi = aqiMatch ? parseInt(aqiMatch[1]) : 0
      return aqi > 300
    }
    if (label === 'Heat Leader' || label === 'Peak City' || label === 'Mumbai' || label === 'Shimla') {
      const tempMatch = valueStr.match(/(-?\d+(?:\.\d+)?)\s*°/)
      const temp = tempMatch ? parseFloat(tempMatch[1]) : 0
      return temp >= 45
    }
    if (label === 'Storm Watch') {
      const rainMatch = valueStr.match(/(\d+)%/)
      const rainChance = rainMatch ? parseInt(rainMatch[1]) : 0
      return rainChance >= 80
    }
    return false
  }

  const items = [
    { icon: '🔥', label: 'Heat Leader', value: `${leaderBase[0]?.city} ${leaderBase[0]?.temp}°C` },
    { icon: '🌡️', label: 'Peak City', value: `${leaderBase[1]?.city} ${leaderBase[1]?.temp}°C` },
    { icon: '💨', label: 'AQI Alert', value: liveAqiAlert
        ? `${liveAqiAlert.city} ${liveAqiAlert.aqi} ${getAQICategory(liveAqiAlert.aqi).label}`
        : 'Loading...' },
    { icon: '🌊', label: 'Climate', value: 'El Niño Active' },
    { icon: '🛰️', label: 'Sat Pass', value: 'Next 16:45 IST' },
    { icon: '⚡', label: 'Storm Watch', value: liveStormWatch
        ? `${liveStormWatch.city} ${liveStormWatch.rainChance}% rain`
        : 'Loading...' },
    { icon: '🌡️', label: 'Mumbai', value: typeof liveMumbai === 'number' ? `${liveMumbai}°C` : '...' },
    { icon: '🌿', label: 'Shimla', value: typeof liveShimla === 'number' ? `${liveShimla}°C` : '...' }
  ]

  // Mobile layout: no scrolling marquee — a single static line with the badge, only the
  // genuinely critical values (or the heat leader if nothing is critical), and SAT ACTIVE.
  if (compact) {
    const critical = items.filter(item => isCritical(item.label, item.value))
    const shown = (critical.length ? critical : items).slice(0, 1) // one item, full width — two truncate at 375px
    return (
      <div style={{
        display: 'flex', alignItems: 'center', height: 30, gap: 10, padding: '0 12px',
        background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden'
      }}>
        <div title={cacheStale ? 'Bulk weather cache is older than 36h' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: badge.color, flexShrink: 0 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: badge.color, animation: badge.pulse ? 'navPulse 1s ease-in-out infinite' : 'none' }} />
          {badge.text}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 12, overflow: 'hidden' }}>
          {shown.map(item => {
            const crit = isCritical(item.label, item.value)
            return (
              <div key={item.label} style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                <span>{item.icon}</span>
                <span style={{ fontWeight: 600, color: '#cbd5e1' }}>{item.label}:</span>
                <span className={crit ? 'ticker-critical' : ''} style={{ color: crit ? '#b91c1c' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.value}</span>
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#86efac', flexShrink: 0 }}>● SAT ACTIVE</div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', height: 28,
      background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)',
      padding: '0 16px', gap: 12, overflow: 'hidden'
    }}>
      {/* LIVE / CACHED / OFFLINE badge */}
      <div title={cacheStale ? 'Bulk weather cache is older than 36h' : undefined} style={{
        display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700,
        color: badge.color, flexShrink: 0
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: badge.color,
          animation: badge.pulse ? 'navPulse 1s ease-in-out infinite' : 'none'
        }} />
        {badge.text}
      </div>

      {/* Scrolling ticker */}
      <div style={{
        flex: 1, display: 'flex', gap: 20, overflow: 'hidden', position: 'relative'
      }}>
        <div style={{
          display: 'flex', gap: 20,
          animation: 'navTicker 40s linear infinite'
        }}>
          {[...items, ...items].map((item, i) => {
            const critical = isCritical(item.label, item.value)
            return (
              <div key={i} style={{
                display: 'flex', gap: 6, alignItems: 'center',
                fontSize: 10, color: '#cbd5e1', whiteSpace: 'nowrap', flexShrink: 0
              }}>
                <span>{item.icon}</span>
                <span style={{ fontWeight: 600 }}>{item.label}:</span>
                <span className={critical ? 'ticker-critical' : ''} style={{ color: critical ? '#b91c1c' : '#94a3b8' }}>
                  {item.value}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* SAT ACTIVE badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700,
        color: '#86efac', flexShrink: 0, paddingLeft: 12, borderLeft: '1px solid rgba(255,255,255,0.1)'
      }}>
        ● SAT ACTIVE
      </div>
    </div>
  )
}

// Self-contained 1Hz clock, isolated in its own leaf component. Previously `currentTime`
// lived in App's top-level state with a setInterval(...,1000) — every tick re-rendered the
// ENTIRE App tree, including the unmemoized IndiaMap (large GeoJSON, many SVG paths), which
// a CDP trace showed costing 1-5+ seconds of synchronous React work per tick — the actual
// cause of the reported cursor/app lag, confirmed by isolating this state down here.
const LiveClock = () => {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10,
      textAlign: 'right', color: '#cbd5e1',
      // Fixed-width digits + a floor on the width: otherwise the 1Hz re-render
      // changes the clock's width by a pixel or two as digits change, which
      // nudges everything to its left (the view-mode toggle) every second.
      fontVariantNumeric: 'tabular-nums', minWidth: 70
    }}>
      <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.08em' }}>
        {now.toLocaleTimeString('en-IN', { hour12: false })}
      </div>
      <div style={{ fontSize: 8, color: '#64748b', letterSpacing: '0.08em' }}>
        {now.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase().replace(/\./, '')} · IST
      </div>
    </div>
  )
}

const CompactNavbar = ({ currentUser, setScreen, scrollToMap, onLogout, leaderBase, liveAqiAlert, liveStormWatch, liveMumbai, liveShimla, cacheStatus, cacheStale, viewMode, onViewModeChange, audience = 'authority', onAudienceChange, lite = false, onLiteChange, citizenSummary }) => {
  const citizen = audience === 'citizen'
  const otherAudience = citizen ? 'authority' : 'citizen'
  const { t, i18n } = useTranslation()
  const isAdmin = currentUser?.role === 'admin'

  // Right-edge fade hint for the scrollable nav row below — same reasoning
  // and mechanism as the dashboard tab bar's overflow hint (ref-measured
  // against scrollWidth/clientWidth, not a fixed breakpoint, since translated
  // pill/label text length varies across the app's 11 languages).
  const navRowRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [navRowOverflow, setNavRowOverflow] = useState({ left: false, right: false })
  const updateNavRowOverflow = useCallback(() => {
    const el = navRowRef.current
    if (!el) return
    setNavRowOverflow({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    })
  }, [])
  useEffect(() => {
    updateNavRowOverflow()
    window.addEventListener('resize', updateNavRowOverflow)
    return () => window.removeEventListener('resize', updateNavRowOverflow)
  }, [updateNavRowOverflow])

  const statusPills = [
    { icon: '🔴', label: 'HEAT', value: 'HIGH', color: '#dc2626', border: 'rgba(185,28,28,0.55)' },
    { icon: '🟡', label: 'CLIMATE', value: 'EL NIÑO', color: '#eab308', border: 'rgba(202,138,4,0.55)' },
    { icon: '🟢', label: 'SYSTEM', value: 'OPS', color: '#22c55e', border: 'rgba(21,128,61,0.55)' }
  ]
  // Citizen top bar: plain-language essentials instead of system badges + ticker
  const riskColor = { Extreme: '#dc2626', High: '#ea580c', Medium: '#eab308', Low: '#22c55e' }
  const citizenStrip = (
    <div data-testid="citizen-strip" style={{
      display: 'flex', alignItems: 'center', gap: 10, height: 34, padding: '0 14px', overflow: 'hidden',
      background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 11, color: '#e2e8f0'
    }}>
      {citizenSummary?.city ? (
        <>
          <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>📍 {citizenSummary.city}</span>
          {citizenSummary.temp != null && <span style={{ whiteSpace: 'nowrap' }}>🌡️ {citizenSummary.temp}°C{citizenSummary.cached ? ' (cached)' : ''}</span>}
          {citizenSummary.risk && (
            <span style={{ whiteSpace: 'nowrap', fontWeight: 700, fontSize: 10, padding: '2px 8px', borderRadius: 999, color: riskColor[citizenSummary.risk], border: `1px solid ${riskColor[citizenSummary.risk]}88` }}>
              {citizenSummary.risk} risk
            </span>
          )}
          {citizenSummary.aqiLabel && <span style={{ whiteSpace: 'nowrap', color: '#cbd5e1' }}>Air: {citizenSummary.aqiLabel}</span>}
          {citizenSummary.wx && <span data-testid="citizen-wx" style={{ whiteSpace: 'nowrap', color: '#cbd5e1' }}>{citizenSummary.wx}</span>}
          {citizenSummary.tip && <span style={{ color: '#94a3b8', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>💡 {citizenSummary.tip}</span>}
        </>
      ) : (
        <span style={{ color: '#94a3b8' }}>📍 Tap a state on the map to see your city's heat risk and what to do today</span>
      )}
    </div>
  )
  const audienceSwitchRow = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ fontSize: 11, color: '#94a3b8' }}>View: <strong style={{ color: '#e2e8f0' }}>{citizen ? 'Citizen' : 'Authority'}</strong> ⚙️</span>
      <button type="button" onClick={() => { onAudienceChange?.(otherAudience); setMenuOpen(false) }} style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, background: 'transparent', border: '1px solid rgba(217,119,6,0.45)', color: '#d97706', borderRadius: 6, cursor: 'pointer' }}>
        Switch to {citizen ? 'Authority' : 'Citizen'}
      </button>
    </div>
  )

  const liteSwitchRow = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ fontSize: 11, color: '#94a3b8' }}>⚡ Lite mode: <strong style={{ color: '#e2e8f0' }}>{lite ? 'On' : 'Off'}</strong></span>
      <button type="button" onClick={() => { onLiteChange?.(!lite); setMenuOpen(false) }} style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, background: 'transparent', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.4)', borderRadius: 6, cursor: 'pointer' }}>
        {lite ? 'Switch off' : 'Turn on (slower phones)'}
      </button>
    </div>
  )

  const logoutBtnStyle = {
    padding: '8px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
    background: 'transparent', color: '#dc2626', border: '1px solid rgba(185,28,28,0.5)', borderRadius: 6, cursor: 'pointer'
  }

  // ── Mobile layout: nothing important lives behind a horizontal scroll ──
  //   row 1: brand + ☰ (opens a drawer with layout toggle, language, profile, LOGOUT)
  //   row 2: the three status pills (fit at 375px)
  //   row 3: static ticker with only the critical values (TickerBar compact)
  if (viewMode === 'compact') {
    return (
      <>
        <div style={{ position: 'relative', background: 'linear-gradient(90deg, rgba(4,11,26,0.98), rgba(9,18,40,0.95))', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 48, padding: '0 12px' }}>
            <div style={{ fontSize: 18 }}>🛰️</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: '#d97706' }}>BHASKAR OPS</div>
              <div style={{ fontSize: 8, letterSpacing: '0.12em', color: '#64748b' }}>THERMAL</div>
            </div>
            <div style={{ flex: 1 }} />
            <LiveClock />
            <button
              type="button"
              onClick={() => setMenuOpen(o => !o)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              style={{
                width: 40, height: 36, borderRadius: 8, fontSize: 18, lineHeight: 1,
                background: menuOpen ? 'rgba(217,119,6,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${menuOpen ? 'rgba(217,119,6,0.6)' : 'rgba(255,255,255,0.12)'}`,
                color: menuOpen ? '#d97706' : '#e2e8f0', cursor: 'pointer', flexShrink: 0
              }}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
          {!citizen && (
          <div style={{ display: 'flex', gap: 8, padding: '0 12px 8px', justifyContent: 'space-between' }}>
            {statusPills.map(pill => (
              <div key={pill.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, fontSize: 8, fontWeight: 700, color: pill.color, border: `1px solid ${pill.border}`, borderRadius: 4, padding: '4px 6px', textAlign: 'center' }}>
                <span style={{ letterSpacing: '0.08em' }}>{pill.label}</span>
                <span>{pill.value}</span>
              </div>
            ))}
          </div>
          )}
          {menuOpen && (
            <div
              data-testid="mobile-menu"
              style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1300,
                background: 'rgba(9,18,40,0.98)', borderBottom: '1px solid rgba(217,119,6,0.35)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.5)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Layout</span>
                <ViewModeToggle mode={viewMode} onChange={m => { onViewModeChange?.(m); setMenuOpen(false) }} size="md" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Language</span>
                <LanguageDropdown />
              </div>
              {audienceSwitchRow}
              {liteSwitchRow}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Signed in as</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{currentUser?.name || 'User'} <span style={{ fontSize: 9, color: '#22c55e', marginLeft: 6 }}>🤖 AGENT ONLINE</span></span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => { setScreen?.('profile'); setMenuOpen(false) }} style={{ flex: 1, padding: '8px 12px', fontSize: 11, fontWeight: 700, background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.45)', color: '#d97706', borderRadius: 6, cursor: 'pointer' }}>👤 My Profile</button>
                <button type="button" onClick={() => { setMenuOpen(false); setScreen('signin'); onLogout?.() }} style={{ ...logoutBtnStyle, flex: 1 }}>{t('nav.signOut', 'LOGOUT')}</button>
              </div>
            </div>
          )}
        </div>
        {citizen ? citizenStrip : (
        <TickerBar
          leaderBase={leaderBase}
          liveAqiAlert={liveAqiAlert}
          liveStormWatch={liveStormWatch}
          liveMumbai={liveMumbai}
          liveShimla={liveShimla}
          cacheStatus={cacheStatus}
          cacheStale={cacheStale}
          compact
        />
        )}
      </>
    )
  }

  return (
    <>
      {/* Main navbar row — 52px. Logo+pills alone already approach ~400px of
          intrinsic content (each pill/logo/divider has its own min-width:auto
          content floor, same flexbox default that made the earlier
          right-section-only fix ineffective — shrinking one flex item does
          nothing if the ones before it in the row aren't shrinking either),
          so under ~700-800px wide the whole row overflows before clock/
          language/agent-badge/avatar/LOGOUT are even reached. Rather than
          wrap (measured as visually overlapping the ticker bar below — a
          flex-wrap container's reported height didn't account for its second
          line's actual height) this scrolls the whole row as one contained
          unit, same proven pattern as the dashboard tab bar, so every
          control — especially LOGOUT — stays reachable via a swipe with zero
          overlap risk. flexShrink:0 on every child keeps things from
          squishing instead of scrolling. */}
      <div style={{ position: 'relative' }}>
      <div
        ref={navRowRef}
        onScroll={updateNavRowOverflow}
        className="tab-bar-scroll"
        style={{
          display: 'flex', alignItems: 'center', height: 52,
          overflowX: 'auto', WebkitOverflowScrolling: 'touch',
          background: 'linear-gradient(90deg, rgba(4,11,26,0.98), rgba(9,18,40,0.95))',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: '0 16px', gap: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
        {/* Logo & title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ fontSize: 20 }}>🛰️</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: '#d97706' }}>BHASKAR OPS</div>
            <div style={{ fontSize: 8, letterSpacing: '0.12em', color: '#64748b' }}>THERMAL</div>
          </div>
        </div>

        {!citizen && (<>
        {/* Divider */}
        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

        {/* Status pills — all inline */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          {statusPills.map(pill => (
            <div
              key={pill.label}
              style={{
                display: 'flex', flexDirection: 'column', gap: 1,
                fontSize: 8, fontWeight: 700, color: pill.color,
                background: 'transparent',
                border: `1px solid ${pill.border}`,
                borderRadius: 4, padding: '4px 8px', minWidth: 48, textAlign: 'center'
              }}
            >
              <span style={{ letterSpacing: '0.08em' }}>{pill.label}</span>
              <span>{pill.value}</span>
            </div>
          ))}
        </div>
        </>)}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Right section — the whole navbar row scrolls now (see comment
            above), so this just needs to not get individually squished. */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          {/* Audience (citizen/authority) and density (mobile/laptop) — two independent toggles */}
          <AudienceToggle audience={audience} onChange={onAudienceChange} />
          <ViewModeToggle mode={viewMode} onChange={onViewModeChange} />

          <LiveClock />

          {/* Language toggle — manual only, no auto-detect by location/browser */}
          <LanguageDropdown />

          {/* Divider */}
          <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />

          {/* Agent badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 9,
            color: '#94a3b8'
          }}>
            <span>🤖</span>
            <div>
              <div style={{ fontWeight: 700, letterSpacing: '0.08em' }}>AGENT</div>
              <div style={{ fontSize: 8, color: '#22c55e', letterSpacing: '0.08em' }}>ONLINE</div>
            </div>
          </div>

          {/* User avatar menu */}
          <UserAvatarMenu
            currentUser={currentUser}
            isAdmin={isAdmin}
            audience={audience}
            lite={lite}
            onLiteChange={onLiteChange}
            onAudienceChange={onAudienceChange}
            setScreen={setScreen}
            onLogout={() => { setScreen('signin'); onLogout?.() }}
          />

          {/* Logout button */}
          <button
            onClick={() => { setScreen('signin') }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(185,28,28,0.12)'
              e.currentTarget.style.color = '#ef4444'
              e.currentTarget.style.borderColor = 'rgba(185,28,28,0.8)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#dc2626'
              e.currentTarget.style.borderColor = 'rgba(185,28,28,0.5)'
            }}
            style={{
              padding: '6px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              background: 'transparent', color: '#dc2626',
              border: '1px solid rgba(185,28,28,0.5)', borderRadius: 4,
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            {t('nav.signOut', 'LOGOUT')}
          </button>
        </div>
      </div>
      {navRowOverflow.left && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 24,
          background: 'linear-gradient(90deg, rgba(4,11,26,0.98), transparent)',
          pointerEvents: 'none'
        }} />
      )}
      {navRowOverflow.right && (
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 24,
          background: 'linear-gradient(270deg, rgba(9,18,40,0.95), transparent)',
          pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          color: 'rgba(255,255,255,0.5)', fontSize: 13, paddingRight: 2
        }}>›</div>
      )}
      </div>

      {/* Ticker bar — 28px (authority) / citizen strip */}
      {citizen ? citizenStrip : (
      <TickerBar
        leaderBase={leaderBase}
        liveAqiAlert={liveAqiAlert}
        liveStormWatch={liveStormWatch}
        liveMumbai={liveMumbai}
        liveShimla={liveShimla}
        cacheStatus={cacheStatus}
        cacheStale={cacheStale}
      />
      )}
    </>
  )
}

function App({ user }) {
  const { t, i18n } = useTranslation()
  // Compact (stacked, full-width map) vs Full (side-by-side). Drives html[data-view-mode]
  // which the layout CSS keys off — one CSS system, no device-specific code paths.
  const { viewMode, setViewMode } = useViewMode()
  // Citizen vs authority audience — independent of the Mobile/Laptop density toggle.
  const { audience, setAudience } = useAudienceMode()
  const citizen = audience === 'citizen'

  // Screen & Auth
  const [screen, setScreen] = useState(user ? "map" : "signin")
  const [userName, setUserName] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [userPassword, setUserPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [mapExpanded, setMapExpanded] = useState(true)
  const [mapScale, setMapScale] = useState(1)
  const [mapPos, setMapPos] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const mapContainerRef = useRef(null)
  // Drag position is mutated directly on this DOM ref during the gesture (bypassing React
  // state) and only committed back to mapPos once on mouseup/touchend — measured before this
  // fix: 40 mousemove events during one drag triggered 90 full App re-renders (every pixel of
  // drag re-rendered the entire map screen tree), which was the actual cause of reported
  // cursor lag while panning the map. Same proven pattern as CustomCursor.jsx.
  const mapTransformRef = useRef(null)
  const liveMapPosRef = useRef({ x: 0, y: 0 })
  const [wideScreen, setWideScreen] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : false)
  const canvasRef = useRef(null)
  const [loginHistory, setLoginHistory] = useState([])

  const scrollToMap = () => {
    mapContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  
  // Map & Selection
  const [selectedState, setSelectedState] = useState(null)
  const [selectedCity, setSelectedCity] = useState(null)
  // Stable reference (useCallback) so IndiaMap's memoized interactive layers don't see a
  // "new" onStateClick prop — and re-render their full GeoJSON — every time App re-renders
  // for an unrelated reason (e.g. live weather polling) while the map screen is showing.
  //
  // The dependency array used to be [selectedState], which defeated the whole point: it gave
  // handleStateClick a NEW reference on every single click (since selectedState itself changes
  // right after), which is exactly the moment this needs to stay stable. A CPU profile of
  // clicking a city showed react-simple-maps re-running its full path/mercatorRaw/
  // polygonContains projection math for ~4.4s of blocked main-thread time per click — this was
  // why: StatesInteractiveLayer/DistrictsLayer/StateBordersLayer all take onStateClick as a
  // prop, so React.memo saw a "changed" prop and recomputed their entire GeoJSON on every
  // click. A ref sidesteps the closure without needing selectedState in the deps at all, so
  // this callback's identity never changes across the component's lifetime.
  const selectedStateRef = useRef(selectedState)
  useEffect(() => { selectedStateRef.current = selectedState }, [selectedState])
  const handleStateClick = useCallback((name) => {
    const fixed = fixStateName(name)
    if (fixed !== selectedStateRef.current) {
      setSelectedState(fixed)
      const defaultCity = (INDIA_DATA[fixed] && Array.isArray(INDIA_DATA[fixed].cities) && INDIA_DATA[fixed].cities.length > 0)
        ? INDIA_DATA[fixed].cities[0]
        : null
      setSelectedCity(defaultCity)
    }
  }, [])
  const [activeTab, setActiveTab] = useState('Overview')
  useEffect(() => {
    // Keep the active tab valid when the audience changes in either direction.
    if (!citizen && activeTab === 'What to do') setActiveTab('Overview')
    if (citizen && ['Analysis', 'Interventions', 'AI + Export'].includes(activeTab)) setActiveTab('Overview')
  }, [citizen, activeTab])
  // Dashboard tab bar overflow-fade hints (mobile: OVERVIEW/ANALYSIS/COMPARE/
  // INTERVENTIONS/AI+EXPORT don't all fit under ~500px). Measured via ref rather
  // than a fixed breakpoint since i18n label lengths vary a lot across the app's
  // 11 languages — a language with longer words could overflow even where English
  // fits, and should still get the hint.
  const tabBarScrollRef = useRef(null)
  const [tabBarOverflow, setTabBarOverflow] = useState({ left: false, right: false })
  const updateTabBarOverflow = useCallback(() => {
    const el = tabBarScrollRef.current
    if (!el) return
    setTabBarOverflow({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    })
  }, [])
  useEffect(() => {
    updateTabBarOverflow()
    window.addEventListener('resize', updateTabBarOverflow)
    return () => window.removeEventListener('resize', updateTabBarOverflow)
  }, [updateTabBarOverflow, selectedCity])
  const [questionDropOpen, setQuestionDropOpen] = useState(false)
  const [globalSearch, setGlobalSearch] = useState("")
  const [globalResults, setGlobalResults] = useState([])

  // Build lookup maps and flat lists once
  const CITY_TO_STATE = useMemo(() => {
    const map = {}
    Object.entries(STATE_DATA).forEach(([state, data]) => {
      ;(data.cities || []).forEach(city => { map[city] = state })
    })
    return map
  }, [])

  const ALL_CITIES_FLAT = useMemo(() => {
    return Object.entries(STATE_DATA).flatMap(([state, data]) =>
      (data.cities || []).map(city => ({ city, state, lst: STATE_DATA[state].avgLST, risk: STATE_DATA[state].risk }))
    ).sort((a,b) => a.city.localeCompare(b.city))
  }, [])

  useEffect(() => {
    if(globalSearch.length < 2) { setGlobalResults([]); return }
    const results = ALL_CITIES_FLAT.filter(c => c.city.toLowerCase().includes(globalSearch.toLowerCase())).slice(0,10)
    setGlobalResults(results)
  }, [globalSearch, ALL_CITIES_FLAT])

  // Dashboard always opens on the Overview tab for a newly selected city
  useEffect(() => {
    setActiveTab('Overview')
  }, [selectedCity])

  // Live weather (Open-Meteo) — single source of truth for current temp/humidity/wind/AQI,
  // replacing the old per-city estimated values for the selected city and comparison city.
  // useWeather() shares one module-level cache across every caller (this, WeatherCard, etc.),
  // so selecting a city triggers exactly one network request, not one per consumer.
  const {
    data: liveWeather, error: liveWeatherError, timedOut: liveWeatherTimedOut,
    isStale: liveWeatherStale, cachedAt: liveWeatherCachedAt, forceRefresh: forceRefreshLiveWeather
  } = useWeather(selectedCity, selectedState, 'App.selectedCity')

  // Plain-language strip for the citizen top bar: city, temperature, risk word, one tip.
  const citizenSummary = useMemo(() => {
    const temp = liveWeather?.current?.temp
    const info = typeof temp === 'number' ? getPrecautionInfo(temp, liveWeather?.aqi?.usAQI) : null
    const riskWord = { EXTREME: 'Extreme', HIGH: 'High', MODERATE: 'Medium', COOL: 'Low', COLD: 'Low' }
    return {
      city: selectedCity || null,
      temp: typeof temp === 'number' ? temp : null,
      risk: info ? (riskWord[info.category] || 'Low') : null,
      tip: info?.items?.[0] || null,
      aqiLabel: liveWeather?.aqi?.category?.label || null,
      cached: !!liveWeather?.isPartial
    }
  }, [selectedCity, liveWeather])

  // Live weather cache for the MAP screen — same live-data pipeline as above, but pre-fetched
  // in bulk for all ~1,700 geocoded cities (via scripts/refreshWeatherCache.mjs, refreshed every
  // ~20 min on the server) rather than fetched per-click. Powers the City List, Hottest Cities
  // panel, Navbar ticker, and State Panel AQI. The currently selected city still gets the
  // extra direct fetch above (liveWeather) for maximal freshness, layered on top of this cache.
  const [liveCityCache, setLiveCityCache] = useState({})
  const [cacheLastUpdated, setCacheLastUpdated] = useState(null)
  // 'loading' | 'ready' | 'error' — surfaced by CacheStatusNote / the ticker badge so a
  // missing or failed cache is visible ("baseline values") instead of silently showing
  // hardcoded seed data as if it were live.
  const [liveCacheStatus, setLiveCacheStatus] = useState('loading')
  const [liveCacheAttempt, setLiveCacheAttempt] = useState(0)
  const retryLiveCache = useCallback(() => setLiveCacheAttempt(a => a + 1), [])

  useEffect(() => {
    // Defer the first fetch to avoid blocking UI on sign-in (500ms lets the map
    // become interactive before heavy JSON parsing starts); retries run immediately.
    let cancelled = false
    setLiveCacheStatus('loading')
    const timer = setTimeout(() => {
      // Up to 3 attempts with backoff before the map is declared cache-less: on a slow
      // link the 40 KB cache competes with the map GeoJSON and can time out once.
      const attempt = (n) => fetchJson('/live-weather-cache.json', { timeoutMs: 20000 })
        .catch(err => {
          if (cancelled || n >= 3) throw err
          return new Promise(r => setTimeout(r, n * 2500)).then(() => attempt(n + 1))
        })
      attempt(1)
        .then(data => {
          if (cancelled) return
          // Every entry carries its own city/state (the leaderboard, ticker and summary read
          // them); derive from the "City|State" key if a writer left them out.
          const cities = normaliseBulkCities(data?.cities)
          setLiveCityCache(cities)
          setCacheLastUpdated(data?.lastUpdated || null)
          // Also register it for useWeather's live-API fallback (see utils/bulkWeatherCache.js)
          setBulkWeatherCache(cities, data?.lastUpdated || null)
          setLiveCacheStatus('ready')
        })
        .catch(err => {
          if (cancelled) return
          console.warn('[live-weather-cache] load failed:', err?.message)
          setLiveCacheStatus('error')
        })
    }, liveCacheAttempt === 0 ? 500 : 0)
    return () => { cancelled = true; clearTimeout(timer) }

  }, [liveCacheAttempt])

  // The cache is rebuilt by GitHub Actions on a schedule, but a tab that stays open only
  // fetched it once — a page opened at dawn kept colouring states from pre-dawn readings
  // all morning ("daily cache from 6 h ago" while production already had a fresh one), and
  // opening a state then flipped it to a different colour. Re-fetch every 15 minutes and
  // when the tab becomes visible again; merge by observedAt so a newer live reading is never
  // replaced by an older cached one. Costs nothing against Open-Meteo's quota.
  useEffect(() => {
    if (liveCacheStatus !== 'ready') return
    let cancelled = false
    const reload = async () => {
      try {
        const data = await fetchJson(`/live-weather-cache.json?t=${Date.now()}`, { timeoutMs: 20000 })
        if (cancelled || !data?.cities) return
        const incoming = normaliseBulkCities(data.cities)
        setLiveCityCache(prev => {
          const next = { ...prev }
          for (const [key, entry] of Object.entries(incoming)) {
            const cur = prev[key]
            const curAt = cur?.observedAt ? new Date(cur.observedAt).getTime() : 0
            const newAt = entry?.observedAt ? new Date(entry.observedAt).getTime() : 0
            if (!cur || newAt > curAt) next[key] = { ...(cur || {}), ...entry }
          }
          queueMicrotask(() => setBulkWeatherCache(next, data.lastUpdated || getBulkWeatherLastUpdated()))
          return next
        })
        if (data.lastUpdated) setCacheLastUpdated(data.lastUpdated)
      } catch (err) {
        console.warn('[live-weather-cache] periodic reload failed:', err?.message)
      }
    }
    const id = setInterval(reload, 15 * 60 * 1000)
    const onVisible = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { cancelled = true; clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [liveCacheStatus])

  // Real RandomForestRegressor metrics (R², MAE, feature_importances_) trained
  // on real MODIS satellite data — see scripts/train_lst_model.py. One global
  // model, not per-city, so this is fetched once and passed to MLModelPanel
  // regardless of which city is selected.
  const [mlModelReal, setMlModelReal] = useState(null)
  const [mlModelError, setMlModelError] = useState(null)
  const [mlModelAttempt, setMlModelAttempt] = useState(0)
  const retryMlModel = useCallback(() => setMlModelAttempt(a => a + 1), [])
  useEffect(() => {
    // Deferred 1s on first load so the map becomes interactive first; retries are immediate.
    let cancelled = false
    setMlModelError(null)
    const timer = setTimeout(() => {
      fetchJson('/data/ml_model_real.json', { timeoutMs: 15000 })
        .then(data => { if (!cancelled) setMlModelReal(data) })
        .catch(err => { if (!cancelled) setMlModelError(err) })
    }, mlModelAttempt === 0 ? 1000 : 0)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [mlModelAttempt])

  // Real ESA WorldCover land-cover classification — only computed for one
  // representative city per state (see scripts/build_lulc_data.py). Cities not
  // in this file fall back to the nearest real entry (getLulcWithFallback) rather
  // than showing nothing — see src/utils/lulcFallback.js.
  const [lulcReal, setLulcReal] = useState(null)
  const [lulcError, setLulcError] = useState(null)
  const [lulcAttempt, setLulcAttempt] = useState(0)
  const retryLulc = useCallback(() => setLulcAttempt(a => a + 1), [])
  useEffect(() => {
    // Deferred 1.5s on first load so the map becomes interactive first; retries are immediate.
    let cancelled = false
    setLulcError(null)
    const timer = setTimeout(() => {
      fetchJson('/data/lulc_real.json', { timeoutMs: 15000 })
        .then(data => { if (!cancelled) setLulcReal(data) })
        .catch(err => { if (!cancelled) setLulcError(err) })
    }, lulcAttempt === 0 ? 1500 : 0)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [lulcAttempt])

  // Precise per-city coordinates (1,932/1,956 cities, state-validated) — used both by the live weather
  // resolver (weatherAPI.js) and to find the nearest real LULC data point for a city that
  // doesn't have its own classification (getLulcWithFallback).
  const [cityCoordsData, setCityCoordsData] = useState(null)
  useEffect(() => {
    const timer = setTimeout(() => {
      loadCityCoordinates().then(setCityCoordsData).catch(() => {})
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  // Real, live OpenStreetMap building density (Overpass API) for the selected city — fetched
  // once liveWeather resolves real coordinates. Overpass is a free shared resource with no
  // SLA, so on failure/timeout this stays null and the UI must show "unavailable", never an
  // estimated number.
  const [osmDensity, setOsmDensity] = useState(null)
  const [osmStatus, setOsmStatus] = useState('idle') // idle | loading | error
  useEffect(() => {
    const lat = liveWeather?.lat
    const lon = liveWeather?.lon
    if (typeof lat !== 'number' || typeof lon !== 'number') return
    let cancelled = false
    setOsmStatus('loading')
    setOsmDensity(null)
    getBuildingDensity(lat, lon)
      .then(result => { if (!cancelled) { setOsmDensity(result); setOsmStatus('idle') } })
      .catch(() => { if (!cancelled) setOsmStatus('error') })
    return () => { cancelled = true }
  }, [liveWeather?.lat, liveWeather?.lon])

  const getLiveCity = (city, state) => liveCityCache[`${city}|${state}`] || null

  // When a state is opened, refresh ITS cities' current temperatures in one batched call
  // and merge them into the same cache everything reads from (city list, state average →
  // map colour, ticker). The bulk cache is a once-a-day snapshot; without this the list
  // showed the dawn value (Udaipur 23 °C) next to the selected city's live value (28 °C).
  const [stateRefreshedAt, setStateRefreshedAt] = useState({})
  // Smart Mitigation Planner (Authority): opened from the state panel; its funded cities are
  // drawn on the map as markers, and clicking a marker opens that city's line in the plan.
  const [plannerOpen, setPlannerOpen] = useState(false)
  const [plannerMarkers, setPlannerMarkers] = useState([])
  const [plannerFocusCity, setPlannerFocusCity] = useState(null)
  useEffect(() => { setPlannerOpen(false); setPlannerMarkers([]); setPlannerFocusCity(null) }, [selectedState])
  const handlePlannerHighlight = useCallback(cities => setPlannerMarkers(cities), [])
  const { lite, setLite } = useLiteMode()

  // Whole-map live sample (one batched call, ~8 cities/state): every state's colour comes
  // from the same CURRENT vintage right after the cache loads, so clicking a state no
  // longer flips it to a different colour era than its neighbours.
  useEffect(() => {
    if (liveCacheStatus !== 'ready') return
    let cancelled = false
    const stateCities = Object.fromEntries(Object.entries(STATE_DATA).map(([st, d]) => [st, d.cities || []]))
    const run = (force) => refreshAllStatesSample(stateCities, { force }).then(res => {
      if (cancelled || !res) return
      setLiveCityCache(prev => {
        const next = { ...prev }
        for (const [key, fresh] of Object.entries(res.entries)) next[key] = { ...(prev[key] || {}), ...fresh }
        queueMicrotask(() => setBulkWeatherCache(next, getBulkWeatherLastUpdated()))
        return next
      })
    })
    // Open-Meteo's free quota is per IP and weighted by locations: 36 states × 8 cities every
    // 10 minutes exhausted it in a long session and every later sample came back 429 (seen
    // in testing) — the map then fell back to the cache honestly, but silently. So: sample
    // only when the cache itself is older than 45 minutes (fresh cache = nothing to fix),
    // and every 20 minutes rather than 10.
    const cacheAgeMs = () => { const iso = getBulkWeatherLastUpdated(); return iso ? Date.now() - new Date(iso).getTime() : Infinity }
    const runIfStale = (force) => { if (cacheAgeMs() > 45 * 60 * 1000) run(force) }
    runIfStale(false)
    const id = setInterval(() => runIfStale(true), 20 * 60 * 1000)
    const onVisible = () => { if (document.visibilityState === 'visible') runIfStale(false) }
    document.addEventListener('visibilitychange', onVisible)
    return () => { cancelled = true; clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [liveCacheStatus])
  useEffect(() => {
    if (!selectedState || liveCacheStatus !== 'ready') return
    let cancelled = false
    const cities = STATE_DATA[selectedState]?.cities || []
    refreshStateLive(selectedState, cities).then(res => {
      if (cancelled || !res) return
      setLiveCityCache(prev => {
        const next = { ...prev }
        for (const [key, fresh] of Object.entries(res.entries)) next[key] = { ...(prev[key] || {}), ...fresh }
        // keep useWeather's offline fallback in step (outside the updater — updaters must stay pure)
        queueMicrotask(() => setBulkWeatherCache(next, getBulkWeatherLastUpdated()))
        return next
      })
      setStateRefreshedAt(prev => ({ ...prev, [selectedState]: res.fetchedAt }))
    })
    return () => { cancelled = true }
  }, [selectedState, liveCacheStatus])

  const liveLeaderBase = useMemo(() => {
    const all = Object.values(liveCityCache).filter(c => typeof c.temp === 'number')
    if (all.length === 0) return leaderBase // seed list shown only until the cache first loads
    return [...all]
      .sort((a, b) => b.temp - a.temp)
      .slice(0, 5)
      .map((c, i) => ({ city: c.city, state: c.state, temp: c.temp, tempMax: typeof c.tempMax === 'number' ? c.tempMax : null, hot: i < 4 }))
  }, [liveCityCache])

  // Today's forecast high across all cities — the number Google-style "hottest city today"
  // lists quote (a day's peak), shown beside our "right now" leader so the two never look
  // like a contradiction.
  const livePeakCity = useMemo(() => {
    const all = Object.values(liveCityCache).filter(c => typeof c.tempMax === 'number')
    return all.length ? all.reduce((m, c) => (c.tempMax > m.tempMax ? c : m), all[0]) : null
  }, [liveCityCache])

  // Powers the "Today's National Heat Summary" shown in the right panel before any state is
  // selected — reuses the same live bulk-cache data as liveLeaderBase/liveStateAqi, just
  // aggregated nationally instead of per-state, so it costs no extra fetch.
  const nationalAvgTemp = useMemo(() => {
    const liveTemps = Object.values(liveCityCache).filter(c => typeof c.temp === 'number').map(c => c.temp)
    if (liveTemps.length > 0) return liveTemps.reduce((a, b) => a + b, 0) / liveTemps.length
    // Live cache hasn't loaded yet — fall back to the state-level baseline average
    const baselineTemps = Object.values(STATE_DATA).map(s => s.avgLST)
    return baselineTemps.reduce((a, b) => a + b, 0) / baselineTemps.length
  }, [liveCityCache])

  // Live per-state heat index — the mean of that state's cached live city temperatures
  // (same bulk Open-Meteo cache that powers the ticker/leader lists; entries carry their
  // own .state field, so this self-extends as the cache gains cities). Replaces
  // STATE_DATA's hardcoded per-state avgLST as the map-coloring source.
  // State heat index (the number) = the MEDIAN of its cities' live temperatures — "the
  // temperature half the state's cities reach". The map COLOUR, since 5 Sept 2026, is the
  // plurality risk category of those same cities (riskBucket below, see pluralityBucket):
  // whichever bucket holds the most cities wins, ties go to the more severe bucket. The
  // median is kept as the headline number and supporting detail in the tooltip/panel.
  const liveStateHeatIndex = useMemo(() => {
    // Prefer the freshest vintage per state: when a state has enough readings observed in
    // the last 15 minutes (the map-load sample, or the full refresh a selection triggers),
    // its median uses ONLY those — mixing 8 fresh readings into 70 day-old ones would let
    // the stale majority swamp the live signal. States with no fresh readings fall back to
    // the daily cache, and the tooltip says which vintage it is.
    // 45 min window vs the 10-min re-sample interval: several sample cycles can fail
    // before anything reverts to cache colours (and then it reverts honestly, with the
    // tooltip saying "from the daily cache").
    const FRESH_MS = 45 * 60 * 1000
    const now = Date.now()
    const all = {}
    const fresh = {}
    for (const c of Object.values(liveCityCache)) {
      if (typeof c.temp !== 'number' || !c.state) continue
      ;(all[c.state] || (all[c.state] = [])).push(c.temp)
      if (c.observedAt && now - new Date(c.observedAt).getTime() < FRESH_MS) {
        ;(fresh[c.state] || (fresh[c.state] = [])).push(c.temp)
      }
    }
    const out = {}
    for (const [state, arrAll] of Object.entries(all)) {
      const arrFresh = fresh[state] || []
      const useFresh = arrFresh.length >= Math.min(5, arrAll.length)
      const arr = (useFresh ? arrFresh : arrAll).slice().sort((a, b) => a - b)
      const n = arr.length
      // upper median for even counts: with exactly half the cities at ≥ 30 the state reads 30
      const median = arr[Math.floor(n / 2)]
      const mean = arr.reduce((a, b) => a + b, 0) / n
      const plural = pluralityBucket(arr)
      out[state] = {
        heatIndex: Math.round(median * 10) / 10,
        meanTemp: Math.round(mean * 10) / 10,
        riskBucket: plural.bucket,      // what colours the map (plurality of city categories)
        bucketCounts: plural.counts,    // per-category city counts for tooltip / detail panel
        cityCount: n,
        vintage: useFresh ? (arrFresh.length >= arrAll.length ? 'live' : 'sample') : 'cache'
      }
    }
    return out
  }, [liveCityCache])

  // Per-state weather-OVERLAY condition — visual add-on for the map, separate from and
  // never touching the heat-index color logic above. Same aggregation pattern as
  // liveStateHeatIndex (mean across that state's cached live cities), fed by the same
  // liveCityCache bulk pipeline (cloudCover/pm10 added to refreshWeatherCache.mjs
  // alongside the existing temp/rainChance/aqi fields it already fetched — no new API
  // call, just two more fields on the same batched Open-Meteo requests).
  // Priority when more than one condition applies: dust > rain > cloud (dust is the
  // rarest/most severe and visually distinct; matches the Jaisalmer dust-storm example).
  const WEATHER_OVERLAY_DUST_PM10 = 400   // µg/m³ — "very high PM10", per the Jaisalmer case
  const WEATHER_OVERLAY_RAIN_CHANCE = 60  // % precipitation probability — "active rain"
  const WEATHER_OVERLAY_CLOUD_COVER = 80  // % cloud cover — "heavy cloud"
  const liveStateWeatherCondition = useMemo(() => {
    const sums = {}
    for (const c of Object.values(liveCityCache)) {
      if (!c.state) continue
      const s = sums[c.state] || (sums[c.state] = { pm10Total: 0, pm10N: 0, rainTotal: 0, rainN: 0, cloudTotal: 0, cloudN: 0 })
      if (typeof c.pm10 === 'number') { s.pm10Total += c.pm10; s.pm10N++ }
      if (typeof c.rainChance === 'number') { s.rainTotal += c.rainChance; s.rainN++ }
      if (typeof c.cloudCover === 'number') { s.cloudTotal += c.cloudCover; s.cloudN++ }
    }
    const out = {}
    for (const [state, s] of Object.entries(sums)) {
      const avgPm10 = s.pm10N ? s.pm10Total / s.pm10N : null
      const avgRain = s.rainN ? s.rainTotal / s.rainN : null
      const avgCloud = s.cloudN ? s.cloudTotal / s.cloudN : null
      let type = 'clear'
      if (avgPm10 !== null && avgPm10 >= WEATHER_OVERLAY_DUST_PM10) type = 'dust'
      else if (avgRain !== null && avgRain >= WEATHER_OVERLAY_RAIN_CHANCE) type = 'rain'
      else if (avgCloud !== null && avgCloud >= WEATHER_OVERLAY_CLOUD_COVER) type = 'cloud'
      out[state] = { type, avgPm10, avgRain, avgCloud }
    }
    return out
  }, [liveCityCache])

  // Citizen strip: the selected city's state-level weather condition (rain / dust / cloud)
  // shown as words, instead of the national overlay layer.
  const WX_WORDS = { dust: '🌫️ Dusty air (high PM10)', rain: '🌧️ Rain likely', cloud: '☁️ Heavy cloud' }
  const citizenWx = selectedState ? (WX_WORDS[liveStateWeatherCondition?.[selectedState]?.type] || null) : null

  // INDIA_DATA with the live heat index merged in. heatIndexLive marks whether a state's
  // value is genuinely live (mean of N live city temps) or still the hardcoded avgLST
  // fallback — consumers must label the fallback "(estimated)", never present it silently
  // as live data. Identity changes exactly once (when the bulk cache loads), so the map's
  // memoized GeoJSON layers re-render once, not per-interaction.
  const liveIndiaData = useMemo(() => {
    return Object.fromEntries(Object.entries(INDIA_DATA).map(([state, data]) => {
      const live = liveStateHeatIndex[state]
      const weatherCondition = liveStateWeatherCondition[state] || { type: 'clear' }
      return [state, live
        ? { ...data, heatIndex: live.heatIndex, meanTemp: live.meanTemp, heatIndexLive: true, liveCityCount: live.cityCount, heatIndexVintage: live.vintage, riskBucket: live.riskBucket, bucketCounts: live.bucketCounts, weatherCondition }
        : { ...data, heatIndexLive: false, weatherCondition }]
    }))
  }, [liveStateHeatIndex, liveStateWeatherCondition])

  // Count of states currently in the HIGH/VERY HIGH/EXTREME buckets (>= 35, per
  // HEAT_INDEX_BUCKETS) — from live values once the cache is in, else the hardcoded
  // risk field as a pre-load fallback.
  const extremeOrHighRiskStateCount = useMemo(() => {
    const states = Object.values(liveIndiaData)
    if (states.some(s => s.heatIndexLive)) {
      return states.filter(s => (s.riskBucket ? s.riskBucket.min >= 35 : s.heatIndex >= 35)).length
    }
    return Object.values(STATE_DATA).filter(s => s.risk === 'EXTREME' || s.risk === 'HIGH').length
  }, [liveIndiaData])

  const liveWorstAqiCity = useMemo(() => {
    const all = Object.values(liveCityCache).filter(c => typeof c.aqi === 'number')
    return all.length ? all.reduce((max, c) => (c.aqi > max.aqi ? c : max), all[0]) : null
  }, [liveCityCache])

  const liveRainiestCity = useMemo(() => {
    const all = Object.values(liveCityCache).filter(c => typeof c.rainChance === 'number')
    return all.length ? all.reduce((max, c) => (c.rainChance > max.rainChance ? c : max), all[0]) : null
  }, [liveCityCache])

  const liveStateAqi = useMemo(() => {
    if (!selectedState) return null
    const cities = STATE_DATA[selectedState]?.cities || []
    const vals = cities
      .map(c => getLiveCity(c, selectedState)?.aqi)
      .filter(v => typeof v === 'number')
    if (vals.length === 0) return null
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  }, [selectedState, liveCityCache])

  function formatAgo(iso) {
    if (!iso) return null
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    if (mins < 48 * 60) return `${Math.round(mins / 60)}h ago`
    return `${Math.round(mins / (60 * 24))}d ago`
  }

  // The bulk weather cache (live-weather-cache.json) is meant to refresh at least every few
  // hours — if the refresh job behind it ever stalls (cron misconfigured, daemon not running,
  // a fresh pull never committed), this catches it and tells the user honestly instead of
  // quietly showing a days-old number as if it were current.
  // 36h, not 24h: the refresh cron is daily, so a 24h threshold flipped the whole UI to
  // "outdated" on a single delayed run. 36h tolerates one late run but still catches a stall.
  const CACHE_STALE_MS = 36 * 60 * 60 * 1000
  const isCacheStale = (iso) => !!iso && (Date.now() - new Date(iso).getTime()) > CACHE_STALE_MS

  // Sliders (Interventions)
  const [treeSlider, setTreeSlider] = useState(0)
  const [roofSlider, setRoofSlider] = useState(0)
  const [waterSlider, setWaterSlider] = useState(0)
  // Cross-tab awareness: sliders live on the Interventions tab but drive the Analysis tab's
  // heatmap grid. Record when they were last touched so the Analysis tab can flag the grid
  // as freshly updated the next time the user lands on it.
  const [interventionTouchedAt, setInterventionTouchedAt] = useState(0)
  const [showGridUpdatedBadge, setShowGridUpdatedBadge] = useState(false)
  const seenInterventionRef = useRef(0)
  useEffect(() => {
    if (activeTab !== 'Analysis' || interventionTouchedAt <= seenInterventionRef.current) return undefined
    seenInterventionRef.current = interventionTouchedAt
    setShowGridUpdatedBadge(true)
    const timer = setTimeout(() => setShowGridUpdatedBadge(false), 6000)
    return () => clearTimeout(timer)
  }, [activeTab, interventionTouchedAt])
  
  // Auth flows
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotEmail, setForgotEmail] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  
  // AI & Chat
  const [chatHistory, setChatHistory] = useState([])
  const [aiLoading, setAiLoading] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState(0)
  const [language, setLanguage] = useState("English")
  
  // Alerts & Gamification
  const [alerts, setAlerts] = useState([])
  const [points, setPoints] = useState(0)
  const [badges, setBadges] = useState([])
  const [analyzedCities, setAnalyzedCities] = useState([])
  const [challengeDone, setChallengeDone] = useState(false)
  
  // Climate Data
  const [mjoPhase, setMjoPhase] = useState(3)
  const [ensoPhase, setEnsoPhase] = useState("El Niño")
  const [polarVortex, setPolarVortex] = useState("STRONG")
  const [marineHeatwave, setMarineHeatwave] = useState(true)
  const [showGlossary, setShowGlossary] = useState(false)

  // Check for remembered login on app load
  useEffect(() => {
    const remember = JSON.parse(localStorage.getItem("heatops_remember") || "null")
    if(remember && remember.expiry > Date.now()) {
      const users = getUsers()
      const user = users.find(u => u.id === remember.userId)
      if(user) {
        setUserName(user.name || "")
        setUserEmail(user.email || "")
        setScreen(user.role === "admin" ? "admin" : "map")
      }
    }
  }, [])

  // If parent provided a user (from LaunchScreen), use it and switch to map
  useEffect(() => {
    const stored = window.localStorage.getItem('heatops-login-history')
    if (stored) {
      try {
        setLoginHistory(JSON.parse(stored))
      } catch (err) {
        console.warn('Invalid login history', err)
      }
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      setWideScreen(window.innerWidth > 768)
    }
    resize()
    window.addEventListener('resize', resize)

    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.5 + 0.5,
      o: Math.random() * 0.7 + 0.3
    }))

    let frame = 0
    let animId

    const draw = () => {
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      stars.forEach(s => {
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${s.o})`
        ctx.fill()
      })

      const cx = W * 0.62
      const cy = H * 0.52
      const R = Math.min(W, H) * 0.22

      for (let lat = -80; lat <= 80; lat += 20) {
        const y = R * Math.sin(lat * Math.PI / 180)
        const rx = Math.sqrt(Math.max(0, R * R - y * y))
        ctx.beginPath()
        ctx.ellipse(cx, cy + y, rx, rx * 0.3, 0, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(217,119,6,0.35)'
        ctx.lineWidth = 0.8
        ctx.stroke()
      }

      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + frame * 0.008
        ctx.beginPath()
        for (let t = 0; t <= Math.PI * 2; t += 0.05) {
          const x3d = R * Math.cos(t) * Math.cos(angle)
          const y3d = R * Math.sin(t)
          const x2d = cx + x3d
          const y2d = cy + y3d * 0.5
          if (t === 0) ctx.moveTo(x2d, y2d)
          else ctx.lineTo(x2d, y2d)
        }
        ctx.strokeStyle = `rgba(217,119,6,${Math.cos(angle) > 0 ? 0.4 : 0.15})`
        ctx.lineWidth = 0.8
        ctx.stroke()
      }

      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(217,119,6,0.5)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      const orbitA = R * 1.45
      const orbitB = R * 0.55
      const satAngle = frame * 0.025
      const sx = cx + orbitA * Math.cos(satAngle)
      const sy = cy + orbitB * Math.sin(satAngle)

      ctx.save()
      ctx.translate(sx, sy)
      ctx.rotate(satAngle + Math.PI / 4)
      ctx.fillStyle = '#d97706'
      ctx.fillRect(-8, -3, 16, 6)
      ctx.fillStyle = '#22c55e'
      ctx.fillRect(-22, -2, 12, 4)
      ctx.fillRect(10, -2, 12, 4)
      ctx.restore()

      ctx.beginPath()
      ctx.setLineDash([4, 8])
      ctx.ellipse(cx, cy, orbitA, orbitB, 0, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(217,119,6,0.15)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.setLineDash([])

      frame++
      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const addLoginHistory = (entry) => {
    setLoginHistory((prevHistory) => {
      const next = [entry, ...prevHistory].slice(0, 6)
      window.localStorage.setItem('heatops-login-history', JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    if (user && user.name) {
      setUserName(user.name)
      setUserEmail(user.email || '')
      setScreen('map')
      addLoginHistory({
        name: user.name,
        email: user.email || 'unknown',
        timestamp: new Date().toISOString()
      })
    }
  }, [user])

  // Close custom dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if(!e.target.closest("#question-drop-wrap")) setQuestionDropOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // No D3 or TopoJSON map rendering is required; the map is rendered with react-simple-maps.

  // Generate alerts based on selected city data
  useEffect(() => {
    if(!selectedCity || !selectedState) return
    const state = STATE_DATA[selectedState]
    if(!state) return
    
    const newAlerts = []
    // Live state heat index (mean of the state's live city temps) when the cache is in;
    // hardcoded avgLST only as the pre-load fallback.
    const stateHeat = liveIndiaData[selectedState]?.heatIndexLive ? liveIndiaData[selectedState].heatIndex : state.avgLST
    if(stateHeat > 45) newAlerts.push({id:1,icon:'🔴',text:t('alerts.extremeHeat', 'EXTREME heat: LST > 45°C'),color:'#dc2626'})
    if(liveWeather?.aqi?.usAQI > 300) newAlerts.push({id:2,icon:'🟠',text:t('alerts.highAqi', 'HIGH AQI: > 300'),color:'#ea580c'})
    if(state.ndbi > 0.5) newAlerts.push({id:3,icon:'🟡',text:t('alerts.moderateHeat', 'MODERATE urban heat'),color:'#eab308'})
    if(marineHeatwave && ['Gujarat','Maharashtra','Kerala','Tamil Nadu'].includes(selectedState)) {
      newAlerts.push({id:4,icon:'🔵',text:t('alerts.marineHeatwave', 'Marine heatwave active'),color:'#3b82f6'})
    }
    if(polarVortex === 'DISRUPTED') newAlerts.push({id:5,icon:'🟣',text:t('alerts.polarVortexWatch', 'WATCH: Polar vortex disrupted'),color:'#9d4edd'})
    if(newAlerts.length === 0) newAlerts.push({id:6,icon:'🟢',text:t('alerts.allNormal', 'All values normal'),color:'#22c55e'})

    setAlerts(newAlerts)
  }, [selectedState, selectedCity, marineHeatwave, polarVortex, liveWeather, liveIndiaData, t])

  // Sign-in screen
  if(screen === "signin") {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: '#030712',
        display: 'flex',
        alignItems: 'center',
        justifyContent: wideScreen ? 'flex-start' : 'center'
      }}>
        <canvas ref={canvasRef} style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0
        }}/>

        <div style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(13,21,40,0.92)',
          border: '1px solid #1a2a4a',
          borderRadius: '16px',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
          margin: wideScreen ? '0 0 0 8%' : '0 16px'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            width: '100%',
            padding: '32px',
            boxSizing: 'border-box'
          }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#d97706' }}>BhaskarOps</div>
              <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', letterSpacing: 2 }}>
                URBAN HEAT ISLAND MONITORING SYSTEM
              </div>
            </div>

            <div style={{ display: 'flex', gap: 0, background: '#0a0f1e', borderRadius: 8, padding: 4 }}>
              <button style={{
                flex: 1,
                padding: '8px',
                borderRadius: 6,
                border: 'none',
                background: '#d97706',
                color: '#0f172a',
                cursor: 'pointer',
                fontSize: 13
              }}>
                Sign In
              </button>
              <button style={{
                flex: 1,
                padding: '8px',
                borderRadius: 6,
                border: 'none',
                background: 'transparent',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: 13
              }}>
                Register
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>FULL NAME</label>
              <input
                type="text"
                value={userName}
                onChange={e => setUserName(e.target.value)}
                placeholder="Enter your name"
                style={{
                  width: '100%', padding: '10px 14px', background: '#0d1528',
                  border: '1px solid #1a2a4a', borderRadius: 8, color: '#e2e8f0',
                  fontSize: 14, boxSizing: 'border-box', outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>EMAIL</label>
              <input
                type="email"
                value={userEmail}
                onChange={e => setUserEmail(e.target.value)}
                placeholder="your@email.com"
                style={{
                  width: '100%', padding: '10px 14px', background: '#0d1528',
                  border: '1px solid #1a2a4a', borderRadius: 8, color: '#e2e8f0',
                  fontSize: 14, boxSizing: 'border-box', outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>PASSWORD</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={userPassword}
                onChange={e => setUserPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '10px 14px', background: '#0d1528',
                  border: '1px solid #1a2a4a', borderRadius: 8, color: '#e2e8f0',
                  fontSize: 14, boxSizing: 'border-box', outline: 'none'
                }}
              />
              <button onClick={() => setShowPassword(!showPassword)} style={{
                width: '100%', padding: '10px 14px', background: 'transparent',
                border: '1px solid #1a2a4a', borderRadius: 8, color: '#64748b',
                cursor: 'pointer', fontSize: 14
              }}>
                {showPassword ? 'HIDE PASSWORD' : 'SHOW PASSWORD'}
              </button>
            </div>

            {/* Remember Me & Forgot Password */}
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px"}}>
              <label style={{display: "flex", alignItems: "center", gap: "6px", color: "#64748b", cursor: "pointer"}}>
                <input 
                  type="checkbox" 
                  checked={rememberMe} 
                  onChange={e => setRememberMe(e.target.checked)}
                  style={{cursor: "pointer"}}
                />
                Remember me (30 days)
              </label>
              <button 
                onClick={() => {setForgotMode(true); setForgotEmail(userEmail)}}
                style={{background: "none", border: "none", color: "#d97706", cursor: "pointer", textDecoration: "underline"}}
              >
                Forgot password?
              </button>
            </div>

            {forgotMode && (
              <div style={{
                background: "rgba(217,119,6,0.05)",
                border: "1px solid rgba(217,119,6,0.4)",
                borderRadius: "8px",
                padding: "12px",
                color: "#64748b"
              }}>
                <button 
                  onClick={() => setForgotMode(false)}
                  style={{float: "right", background: "none", border: "none", color: "#d97706", cursor: "pointer"}}
                >
                  ✕
                </button>
                <div style={{fontSize: "11px", marginBottom: "8px", fontWeight: "700"}}>PASSWORD RECOVERY</div>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  placeholder="Enter your email"
                  style={{
                    width: '100%', padding: '8px 12px', background: '#0d1528',
                    border: '1px solid #1a2a4a', borderRadius: 6, color: '#e2e8f0',
                    fontSize: 12, boxSizing: 'border-box', marginBottom: '8px'
                  }}
                />
                <button 
                  onClick={() => {
                    const users = getUsers()
                    const user = users.find(u => u.email === forgotEmail)
                    if(user) {
                      const hint = user.name.charAt(0) + "***" + user.name.slice(-1)
                      alert(`💡 Hint: Account registered as "${hint}". Check your registration email.`)
                    } else {
                      alert("❌ Email not found in system")
                    }
                    setForgotMode(false)
                  }}
                  style={{
                    width: '100%', padding: '8px', background: 'rgba(217,119,6,0.15)',
                    border: '1px solid rgba(217,119,6,0.5)', borderRadius: 6, color: '#d97706',
                    cursor: 'pointer', fontSize: 11, fontWeight: 'bold'
                  }}
                >
                  Send Recovery Hint
                </button>
              </div>
            )}

            <button onClick={() => {
              if(submitSignIn(userName, userEmail, userPassword)) {
                // Save remember me if checked
                if(rememberMe) {
                  const users = getUsers()
                  const user = users.find(u => u.email === userEmail)
                  if(user) {
                    localStorage.setItem("heatops_remember", JSON.stringify({
                      email: userEmail,
                      userId: user.id,
                      expiry: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
                    }))
                  }
                }
                setScreen("map")
                addLoginHistory({
                  name: userName,
                  email: userEmail || 'unknown',
                  timestamp: new Date().toISOString()
                })
              }
            }} style={{
              width: '100%', padding: '12px', background: '#d97706',
              border: 'none', borderRadius: 8, color: '#000', fontSize: 15,
              fontWeight: 'bold', cursor: 'pointer', marginTop: 4,
              boxShadow: '0 4px 14px rgba(0,0,0,0.35)'
            }}>
              {t('nav.signIn', 'SIGN IN')}
            </button>

            <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>
              BhaskarOps 2026
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Map screen
  // Map and Dashboard screens are merged into a single conditional branch
  // (rather than each being its own separate early return) so IndiaMap stays
  // mounted continuously across map <-> dashboard navigation instead of
  // unmounting and remounting from scratch every time. Profiled: react-simple-maps
  // has to redo its full district/state geometry projection on every fresh mount,
  // which is genuinely expensive (many seconds of blocked main-thread time) — this
  // was happening every single time a user went "back to map" after checking a
  // city, since the two screens used to be entirely separate return branches.
  // Visibility is toggled with CSS display instead, so the work only ever happens
  // once per session.
  if (screen === "map" || screen === "dashboard") {
    const hottest = liveLeaderBase[0]

    const state = STATE_DATA[selectedState]

    return (
      <>
        <div style={{ display: screen === 'map' ? 'contents' : 'none' }}>
      <div className="map-container">
        {/* Floating AI Assistant restored on the map screen so it's always
            reachable without switching screens. It shows a hint when no city
            is selected. */}
        <FloatingAIAssistant
          audience={audience}
          lite={lite}
          onLiteChange={setLite}
          cityName={selectedCity}
          ensoPhase={ensoPhase}
          lst={liveWeather?.current?.temp}
          ndvi={null}
          ndbi={null}
          aqi={liveWeather?.aqi?.usAQI}
          chatHistory={chatHistory}
          setChatHistory={setChatHistory}
          aiLoading={aiLoading}
          setAiLoading={setAiLoading}
          selectedQuestion={selectedQuestion}
          setSelectedQuestion={setSelectedQuestion}
          questionDropOpen={questionDropOpen}
          setQuestionDropOpen={setQuestionDropOpen}
        />
        {/* Floating AI Assistant removed from the map screen — before a city is
            selected there's no data for it to analyze, so it read as an
            orphaned/unexplained icon. It's still available on every dashboard
            tab (after a city is selected and there's real data behind it). */}

        {/* ✅ NEW COMPACT NAVBAR — replaces old hud-shell */}
        <CompactNavbar
          currentUser={{ name: userName, email: userEmail, role: 'user' }}
          setScreen={setScreen}
          scrollToMap={scrollToMap}
          onLogout={() => { setUserName(''); setUserEmail('') }}
          leaderBase={liveLeaderBase}
          liveAqiAlert={liveWorstAqiCity}
          liveStormWatch={liveRainiestCity}
          liveMumbai={getLiveCity('Mumbai', 'Maharashtra')?.temp}
          liveShimla={getLiveCity('Shimla', 'Himachal Pradesh')?.temp}
          cacheStatus={liveCacheStatus}
          cacheStale={isCacheStale(cacheLastUpdated)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          audience={audience}
          lite={lite}
          onLiteChange={setLite}
          onAudienceChange={setAudience}
          citizenSummary={{ ...citizenSummary, wx: citizenWx }}
        />

        {/* Main content — updated height calculation. On phone widths .map-layout
            (App.css) stacks these two columns so the map gets the full width. */}
        <div className="map-layout" style={{
          display: 'flex',
          gap: 16,
          padding: '12px 16px',
          height: 'calc(100vh - 80px)'
        }}>
          {/* Left: India Map */}
          <div className="map-layout-map" style={{
            flex: '0 0 58%',
            position: 'relative'
          }}>
            <div className={`map-box ${mapExpanded ? 'is-expanded' : 'is-collapsed'}`} style={{
              position: 'relative',
              width: '100%',
              height: mapExpanded ? '70vh' : '48px',
              overflow: 'hidden',
              transition: 'height 0.4s cubic-bezier(0.4,0,0.2,1)',
              border: '1px solid #1a2a4a',
              borderRadius: 12,
              background: '#030b1a'
            }}>
              <button
                onClick={() => setMapExpanded(!mapExpanded)}
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  zIndex: 50,
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(148,163,184,0.4)',
                  borderRadius: 8,
                  color: '#94a3b8',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  letterSpacing: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                ⛶<span className="map-minimize-label">{mapExpanded ? ' MINIMIZE' : ' MAXIMIZE'}</span>
              </button>

              {mapExpanded ? (
                <>
                  <div style={{ marginBottom: 10, padding: '12px 16px 0 16px' }}>
                    <input
                      placeholder={`🔍 ${t('nav.searchPlaceholder', 'Search any city in India...')}`}
                      value={globalSearch}
                      onChange={e => setGlobalSearch(e.target.value)}
                      className="map-search-input"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        background: '#0a0e1a',
                        border: '1px solid #1a2a4a',
                        borderRadius: 8,
                        color: '#fff',
                        // Right padding (see .map-search-input in App.css) reserves space
                        // for the absolutely-positioned MINIMIZE button (top:10/right:10 on
                        // the shared map container) so placeholder/typed text never runs
                        // under it — the exact amount needed differs since the button drops
                        // its text label (see .map-minimize-label) below 480px.
                        padding: '9px 14px',
                        fontSize: 13
                      }}
                    />
                    {globalResults.length > 0 && (
                      <div style={{ position: 'relative', zIndex: 1200 }}>
                        <div style={{ marginTop: 6, maxHeight: 240, overflowY: 'auto', background: '#0f1729', border: '1px solid #1a2a4a', borderRadius: 8 }}>
                          {globalResults.map(res => (
                            <div key={res.city + res.state} onClick={() => {
                              setSelectedState(res.state)
                              setSelectedCity(res.city)
                              setGlobalSearch('')
                              setGlobalResults([])
                              setScreen('dashboard')
                            }} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #1a2a4a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontWeight: 700 }}>{res.city}</div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{res.state}</div>
                              </div>
                              {/* The city's own live cached temp; else the state's LIVE average
                                  (labelled as such); else an honest blank — never the hardcoded
                                  illustrative avgLST. */}
                              {(() => {
                                const live = getLiveCity(res.city, res.state)
                                const sd = liveIndiaData[res.state]
                                const cityLive = typeof live?.temp === 'number'
                                const temp = cityLive ? live.temp : (sd?.heatIndexLive ? sd.heatIndex : null)
                                if (typeof temp !== 'number') {
                                  return (
                                    <div style={{ textAlign: 'right', fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                                      {t('cityList.noLiveData', 'NO LIVE DATA')}
                                    </div>
                                  )
                                }
                                const label = getRiskLabel(temp)
                                return (
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: getRiskText(label) }}>{temp}°C{cityLive ? '' : ' (state median)'}</div>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{label}</div>
                                  </div>
                                )
                              })()}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ height: 'calc(100% - 76px)', padding: '0 16px 16px 16px', boxSizing: 'border-box', position: 'relative' }}>
                    <div
                      ref={mapContainerRef}
                      onWheel={(e) => {
                        e.preventDefault()
                        const delta = e.deltaY > 0 ? -0.15 : 0.15
                        // 1× is already "fit to card" — zooming out further only shrinks India
                        // into empty space, so 1× is the floor and returning to it re-centres.
                        setMapScale(prev => {
                          const next = Math.min(Math.max(prev + delta, 1), 5)
                          if (next === 1 && prev !== 1) setMapPos({ x: 0, y: 0 })
                          return next
                        })
                      }}
                      onMouseDown={(e) => {
                        setIsDragging(true)
                        setDragStart({ x: e.clientX - mapPos.x, y: e.clientY - mapPos.y })
                      }}
                      onMouseMove={(e) => {
                        if (!isDragging) return
                        const next = { x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }
                        liveMapPosRef.current = next
                        if (mapTransformRef.current) {
                          mapTransformRef.current.style.transform = `translate(${next.x}px, ${next.y}px) scale(${mapScale})`
                        }
                      }}
                      onMouseUp={() => {
                        if (isDragging) setMapPos(liveMapPosRef.current)
                        setIsDragging(false)
                      }}
                      onMouseLeave={() => {
                        if (isDragging) setMapPos(liveMapPosRef.current)
                        setIsDragging(false)
                      }}
                      onTouchStart={(e) => {
                        const t = e.touches[0]
                        setIsDragging(true)
                        setDragStart({ x: t.clientX - mapPos.x, y: t.clientY - mapPos.y })
                      }}
                      onTouchMove={(e) => {
                        if (!isDragging) return
                        const t = e.touches[0]
                        const next = { x: t.clientX - dragStart.x, y: t.clientY - dragStart.y }
                        liveMapPosRef.current = next
                        if (mapTransformRef.current) {
                          mapTransformRef.current.style.transform = `translate(${next.x}px, ${next.y}px) scale(${mapScale})`
                        }
                      }}
                      onTouchEnd={() => {
                        if (isDragging) setMapPos(liveMapPosRef.current)
                        setIsDragging(false)
                      }}
                      style={{
                        width: '100%',
                        height: '100%',
                        cursor: isDragging ? 'grabbing' : 'grab',
                        overflow: 'hidden',
                        position: 'relative'
                      }}
                    >
                      {/* IndiaMap now applies the zoom/pan transform internally, only to its
                          own map-layers sub-tree — its tooltip card and heat index legend
                          stay fixed-size regardless of scale. See the comment inside
                          IndiaMap's render for why this moved from wrapping the whole
                          component here to being handled inside it instead. */}
                      {/* Map-level boundary: if the map itself throws while rendering (e.g. a
                          corrupt GeoJSON body that parses but has the wrong shape), only this
                          section shows a fallback — navbar, ticker and the side panels stay up.
                          The root boundary in main.jsx remains the last resort for everything else. */}
                      <AppErrorBoundary compact title="Map could not be displayed">
                        <IndiaMap
                          ref={mapTransformRef}
                          INDIA_DATA={liveIndiaData}
                          selectedState={selectedState}
                          lite={lite}
                          onStateClick={handleStateClick}
                          plannerMarkers={plannerMarkers}
                          onPlannerMarkerClick={(city) => { setPlannerFocusCity(city) }}
                          scale={mapScale}
                          pos={mapPos}
                          isDragging={isDragging}
                          cacheStatus={liveCacheStatus}
                          cacheStale={isCacheStale(cacheLastUpdated)}
                          cacheAgeLabel={formatAgo(cacheLastUpdated)}
                          audience={audience}
                        />
                      </AppErrorBoundary>
                    </div>

                    <div style={{
                      position: 'absolute',
                      bottom: 80,
                      right: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      zIndex: 50
                    }}>
                      <button
                        aria-label="Zoom in"
                        onClick={() => setMapScale(prev => Math.min(prev + 0.3, 5))}
                        style={{
                          width: 44, height: 44,
                          background: 'rgba(0,0,0,0.7)',
                          border: '1px solid rgba(148,163,184,0.4)',
                          borderRadius: 8,
                          color: '#94a3b8',
                          fontSize: 20,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >+</button>
                      <button
                        aria-label="Zoom out"
                        disabled={mapScale <= 1}
                        title={mapScale <= 1 ? 'Already at fit-to-card zoom' : 'Zoom out'}
                        onClick={() => setMapScale(prev => {
                          const next = Math.max(prev - 0.3, 1)
                          if (next === 1) setMapPos({ x: 0, y: 0 })
                          return next
                        })}
                        style={{
                          width: 44, height: 44,
                          background: 'rgba(0,0,0,0.7)',
                          border: '1px solid rgba(148,163,184,0.4)',
                          borderRadius: 8,
                          color: mapScale <= 1 ? 'rgba(148,163,184,0.35)' : '#94a3b8',
                          fontSize: 20,
                          cursor: mapScale <= 1 ? 'default' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >−</button>
                      <button
                        onClick={() => { setMapScale(1); setMapPos({ x: 0, y: 0 }) }}
                        style={{
                          width: 44, height: 44,
                          background: 'rgba(0,0,0,0.7)',
                          border: '1px solid rgba(148,163,184,0.4)',
                          borderRadius: 8,
                          color: '#94a3b8',
                          fontSize: 11,
                          cursor: 'pointer',
                          fontFamily: 'monospace',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >↺</button>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  fontFamily: 'monospace',
                  letterSpacing: 1,
                  fontSize: 12,
                  gap: 10
                }}>
                  <span style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#22c55e',
                    border: '1.5px solid #ffffff',
                    boxShadow: 'none',
                    animation: 'pulse 1.2s ease-in-out infinite'
                  }} />
                  [ INDIA HEAT MAP — CLICK TO EXPAND ]
                </div>
              )}
            </div>
          </div>

          {/* Right: Info Panel — themed by the CLICKED state's heat category (never
              hover, to avoid any continuous mouse-tracking re-renders). */}
          <div className="map-layout-side" style={{
            flex: '0 0 42%',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflowY: 'auto',
            paddingRight: 4,
            scrollbarWidth: 'thin',
            scrollbarColor: '#1a2a4a #0a0e1a',
            // Theme follows the selected city's LIVE temperature; while no city reading exists,
            // the state's LIVE average; only then the illustrative seed (colour only — the seed
            // is never displayed as a number).
            ...(selectedState ? getThemeVars(typeof liveWeather?.current?.temp === 'number'
              ? liveWeather.current.temp
              : (liveIndiaData[selectedState]?.heatIndexLive ? liveIndiaData[selectedState].heatIndex : getAdjustedLST(selectedState))) : {})
          }}>
            {selectedState ? (
              <>
                <div className="state-card">
                  <h3>{selectedState}</h3>
                  {/* Risk badge derived from the LIVE state heat index (same value that
                      colors the map), not STATE_DATA's hardcoded risk string — with an
                      explicit (est.) marker when only the hardcoded fallback exists. */}
                  {(() => {
                    const sd = liveIndiaData[selectedState]
                    const label = sd?.riskBucket?.label || (typeof sd?.heatIndex === 'number' ? getRiskLabel(sd.heatIndex) : (STATE_DATA[selectedState]?.risk || 'N/A'))
                    const c = getRiskBadgeColor(label)
                    return (
                      <span className="risk-badge" style={{ background: c.bg, color: c.text }}>
                        {label}{sd?.heatIndexLive ? '' : ' (est.)'}
                      </span>
                    )
                  })()}
                  {!citizen && (
                    <button
                      data-testid="open-planner"
                      onClick={() => setPlannerOpen(v => !v)}
                      style={{ marginTop: 10, width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d97706', background: plannerOpen ? 'rgba(217,119,6,0.25)' : 'rgba(217,119,6,0.12)', color: '#fbbf24', fontWeight: 800, fontSize: 12, letterSpacing: 0.6, cursor: 'pointer' }}
                    >
                      <PanelIcon name="target" size={12} color="#fbbf24" /> {plannerOpen ? t('planner.closeBtn', 'CLOSE MITIGATION PLANNER') : t('planner.openBtn', 'SMART MITIGATION PLANNER — WHERE SHOULD THE MONEY GO?')}
                    </button>
                  )}
                </div>
                {plannerOpen && !citizen ? (
                  <MitigationPlanner
                    stateName={selectedState}
                    cities={STATE_DATA[selectedState]?.cities || []}
                    liveCityCache={liveCityCache}
                    lulcReal={lulcReal}
                    cityCoordsData={cityCoordsData}
                    onClose={() => setPlannerOpen(false)}
                    onHighlight={handlePlannerHighlight}
                    focusCity={plannerFocusCity}
                  />
                ) : (
                <>

                {/* Why the state has the colour it has: the plurality vote behind the map fill,
                    with the full per-category city counts as supporting detail for a DM. */}
                {liveIndiaData[selectedState]?.riskBucket && (
                  <div data-testid="state-bucket-breakdown" style={{ fontSize: 11, color: '#cbd5e1', margin: '6px 0 10px', lineHeight: 1.5 }}>
                    {t('statePanel.colourRule', 'Map colour = the most common category among {{n}} cities with live readings:', { n: liveIndiaData[selectedState].liveCityCount })}{' '}
                    {liveIndiaData[selectedState].bucketCounts.filter(b => b.count > 0).map((b, i) => (
                      <span key={b.label} data-bucket={b.label} data-count={b.count}>
                        {i > 0 ? ' · ' : ''}
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: b.color, marginRight: 4, verticalAlign: 'middle' }} />
                        <strong>{b.count}</strong> {b.label} ({b.share}%)
                      </span>
                    ))}
                    {liveIndiaData[selectedState].bucketCounts.filter(b => b.count === liveIndiaData[selectedState].riskBucket.count).length > 1 && (
                      <span style={{ color: '#fbbf24' }}> · {t('statePanel.tieRule', 'tie → the more severe category is shown')}</span>
                    )}
                  </div>
                )}
                <div className="metrics-grid">
                  {/* Live state average of the cached/refreshed city temperatures — the same number
                      that colours the state on the map and drives the badge above. The old tile
                      printed STATE_DATA.avgLST (an illustrative seed: "Rajasthan 48.0°C") next to
                      a live-derived LOW-MODERATE badge. */}
                  <div className="metric-card" title={liveIndiaData[selectedState]?.heatIndexLive
                    ? t('statePanel.medianTempTitle', 'Median of the live current temperatures of {{n}} cities in this state — half of them are hotter than this, half cooler. This is the value that colours the state on the map.', { n: liveIndiaData[selectedState].liveCityCount })
                    : t('statePanel.avgTempNoLive', 'No live readings for this state yet')}>
                    <span className="metric-label">{t('statePanel.medianTemp', 'MEDIAN TEMP')}{liveIndiaData[selectedState]?.heatIndexLive ? ` · ${liveIndiaData[selectedState].liveCityCount} ${t('statePanel.cities', 'cities')}` : ''}</span>
                    <span className="metric-value" data-testid="state-avg-temp">
                      {liveIndiaData[selectedState]?.heatIndexLive ? `${liveIndiaData[selectedState].heatIndex.toFixed(1)}°C` : t('cityList.noLiveData', 'NO LIVE DATA')}
                    </span>
                  </div>
                  <div className="metric-card" title={t('statePanel.baselineTitle', 'Illustrative state baseline (not a live satellite reading) — see the Analysis tab for real land-cover data')}>
                    <span className="metric-label">NDVI · {t('statePanel.baseline', 'baseline')}</span>
                    <span className="metric-value">{STATE_DATA[selectedState]?.ndvi?.toFixed(2) ?? '—'}</span>
                  </div>
                  <div className="metric-card" title={t('statePanel.baselineTitle', 'Illustrative state baseline (not a live satellite reading) — see the Analysis tab for real land-cover data')}>
                    <span className="metric-label">NDBI · {t('statePanel.baseline', 'baseline')}</span>
                    <span className="metric-value">{STATE_DATA[selectedState]?.ndbi?.toFixed(2) ?? '—'}</span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-label">AQI</span>
                    <span className="metric-value">{liveStateAqi ?? '...'}</span>
                  </div>
                </div>

                <CityPanel
                  key={selectedState}
                  stateName={selectedState}
                  stateData={STATE_DATA[selectedState]}
                  selectedCity={selectedCity}
                  liveCache={liveCityCache}
                  liveSelectedTemp={liveWeather?.isFallbackLocation ? undefined : liveWeather?.current?.temp}
                  cacheLastUpdated={cacheLastUpdated}
                  stateRefreshedAt={stateRefreshedAt[selectedState] || getStateRefreshedAt(selectedState) || null}
                  cacheStatus={liveCacheStatus}
                  onRetryCache={retryLiveCache}
                  formatAgo={formatAgo}
                  isCacheStale={isCacheStale}
                  onCitySelect={(city) => {
                    // ✅ FIX: Use parameters instead of state closure
                    setSelectedCity(city)
                  }}
                  onAnalyze={() => {
                    setScreen("dashboard")
                    setAnalyzedCities([...new Set([...analyzedCities, selectedCity])])
                    setPoints(points + 10)
                  }}
                />
                </>
                )}

                <div className="hottest-section">
                  <h4><PanelIcon name="flame" /> {t('panels.hottestCities', 'Hottest Cities')}</h4>
                  <CacheStatusNote status={liveCacheStatus} lastUpdated={cacheLastUpdated} isStale={isCacheStale} formatAgo={formatAgo} onRetry={retryLiveCache} marginBottom={4} />
                  <ul>
                    {liveLeaderBase.map((item, i) => (
                      <li key={i}>
                        <span aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: item.hot ? '#dc2626' : '#ea580c', marginRight: 8, verticalAlign: '1px' }} />
                        {item.city}
                        <span>
                          {item.temp}°C
                          {typeof item.tempMax === 'number' && item.tempMax > item.temp && (
                            <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400, fontSize: 10, marginLeft: 6 }} title={t('hottest.peakTitle', "Today's forecast high (Open-Meteo)")}>
                              {t('hottest.peak', 'peak')} {item.tempMax}°
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="legend-section">
                  <h4><PanelIcon name="thermometer" size={13} /> Heat Legend</h4>
                  <div className="legend-item">
                    <span className="legend-dot" style={{background:'#b91c1c'}}/>Extreme {'>44°C'}
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot" style={{background:'#c2410c'}}/>High {'38-44°C'}
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot" style={{background:'#ca8a04'}}/>Moderate {'32-38°C'}
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot" style={{background:'#15803d'}}/>Cool {'<32°C'}
                  </div>
                </div>

                <div className="history-section" style={{marginTop:20, padding:16, border:'1px solid rgba(148,163,184,0.15)', borderRadius:12, background:'rgba(0,0,0,0.35)'}}>
                  <h4 style={{marginBottom:10, color:'#d97706'}}><PanelIcon name="clock" size={13} color="currentColor" /> Recent Sign-ins</h4>
                  {loginHistory.length > 0 ? (
                    <ul style={{listStyle:'none', padding:0, margin:0, display:'grid', gap:8}}>
                      {loginHistory.map((entry, idx) => (
                        <li key={idx} style={{fontSize:12, color:'#cbd5e1', lineHeight:1.4}}>
                          <strong style={{color:'#fff'}}>{entry.name}</strong> · {entry.email}
                          <div style={{fontSize:11, color:'#94a3b8'}}>{new Date(entry.timestamp).toLocaleString('en-IN', {hour12:true})}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{fontSize:12, color:'#94a3b8'}}>{t('signIn.noRecentSignIns', 'No recent sign-ins yet. Your session will be logged after launch.')}</div>
                  )}
                </div>
              </>
            ) : (
              // No state selected yet — fill what used to be dead space with a live national
              // summary instead of just a "click a state" hint, using data already computed
              // elsewhere on this screen (liveLeaderBase, the live bulk weather cache,
              // STATE_DATA) rather than any new fetch.
              <div style={{ padding: '4px 4px 0 4px' }}>
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  textAlign: 'center', padding: '20px 12px', gap: 6
                }}>
                  <div style={{ fontSize: 36 }}>🗺️</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {t('tooltips.clickStateForDetails', 'Click any state on the map')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.7 }}>
                    {t('tooltips.clickStateForDetailsSub', 'to explore cities and heat data')}
                  </div>
                </div>

                <div style={{
                  background: 'rgba(10, 14, 26, 0.6)',
                  border: '1px solid rgba(148,163,184,0.15)',
                  borderRadius: 12,
                  padding: 16
                }}>
                  <h4 style={{ color: '#d97706', borderLeft: '2px solid #d97706', paddingLeft: 8, marginBottom: 10, marginTop: 0 }}>
                    <PanelIcon name="bar-chart" /> {t('nationalSummary.title', "Today's National Heat Summary")}
                  </h4>
                  <CacheStatusNote status={liveCacheStatus} lastUpdated={cacheLastUpdated} isStale={isCacheStale} formatAgo={formatAgo} onRetry={retryLiveCache} marginBottom={10} liveText={t('nationalSummary.live', 'Live')} />

                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ background: 'rgba(184,16,16,0.1)', border: '1px solid rgba(184,16,16,0.3)', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>
                        <PanelIcon name="flame" size={12} color="currentColor" /> {t('nationalSummary.hottestNow', 'Hottest city right now')}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#ff6b6b' }}>
                        {liveLeaderBase[0]?.city}, {liveLeaderBase[0]?.state}
                      </div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{liveLeaderBase[0]?.temp}°C</div>
                    </div>

                    {livePeakCity && (
                      <div style={{ background: 'rgba(184,16,16,0.06)', border: '1px solid rgba(184,16,16,0.2)', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>
                          <PanelIcon name="sun" size={12} color="currentColor" /> {t('nationalSummary.peakToday', "Today's forecast high")}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#fca5a5' }}>
                          {livePeakCity.city}, {livePeakCity.state}
                        </div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{livePeakCity.tempMax}°C <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{t('nationalSummary.peakNote', '(day\'s maximum, Open-Meteo forecast)')}</span></div>
                      </div>
                    )}

                    <div style={{ background: 'rgba(187,82,0,0.1)', border: '1px solid rgba(187,82,0,0.3)', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>
                        <PanelIcon name="thermometer" size={12} color="currentColor" /> {t('nationalSummary.extremeStates', 'States in Extreme/High risk category')}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#ffaa66' }}>
                        {extremeOrHighRiskStateCount} / {Object.keys(STATE_DATA).length}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.3)', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>
                        <PanelIcon name="gauge" size={12} color="currentColor" /> {t('nationalSummary.avgTemp', 'Average national temperature')}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#d97706' }}>
                        {nationalAvgTemp.toFixed(1)}°C
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 8, paddingLeft: 2 }}>
                    <PanelIcon name="zap" /> {t('nationalSummary.quickPicks', 'Quick Picks')}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {QUICK_PICK_CITIES.map(qp => (
                      <button
                        key={qp.city}
                        onClick={() => {
                          setSelectedState(qp.state)
                          setSelectedCity(qp.city)
                          setScreen('dashboard')
                        }}
                        style={{
                          background: 'rgba(217,119,6,0.08)',
                          border: '1px solid rgba(217,119,6,0.3)',
                          borderRadius: 999,
                          color: '#d97706',
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '6px 14px',
                          cursor: 'pointer',
                          transition: 'background 0.2s ease, border-color 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(217,119,6,0.22)'
                          e.currentTarget.style.borderColor = 'rgba(217,119,6,0.6)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(217,119,6,0.08)'
                          e.currentTarget.style.borderColor = 'rgba(217,119,6,0.3)'
                        }}
                      >
                        {qp.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
        </div>

        {state && (() => {
    // Get real city data
    const cityData = getCityData(selectedCity, selectedState)
    const lst = cityData.lst
    // Base temperature for the Analysis heatmap grid and the Interventions preview: the
    // selected city's LIVE current temperature; else the state's live median; only then the
    // illustrative seed. The old grid ran off the seed alone — Udaipur showed a 44 °C grid
    // under a 27 °C Overview.
    const liveCityTemp = typeof liveWeather?.current?.temp === 'number' ? liveWeather.current.temp : null
    const liveStateMedian = liveIndiaData[selectedState]?.heatIndexLive ? liveIndiaData[selectedState].heatIndex : null
    const gridBase = liveCityTemp ?? liveStateMedian ?? cityData.lst
    const gridBaseSource = liveCityTemp != null ? 'live' : liveStateMedian != null ? 'median' : 'seed'
    const gridBaseLabel = gridBaseSource === 'live'
      ? t('grid.baseLive', 'Base {{t}}°C = live current temperature of {{city}}', { t: gridBase.toFixed(1), city: selectedCity })
      : gridBaseSource === 'median'
        ? t('grid.baseMedian', 'Base {{t}}°C = live median of {{state}} (no live reading for {{city}} yet)', { t: gridBase.toFixed(1), state: selectedState, city: selectedCity })
        : t('grid.baseSeed', 'Base {{t}}°C = illustrative seed — no live reading available', { t: gridBase.toFixed(1) })
    // Real values for anything cited as data (AI context, exports) — separate from the
    // illustrative `lst`/`state` values still used for theming and the what-if simulator below.
    const realSurfaceTemp = liveWeather?.current?.surfaceTemp
    const realLulcEntry = lulcReal?.cities?.[selectedCity]

    // Citizens get two plain tabs; the full technical set is authority-only.
    // Citizens get Compare too — "is my city hotter than my parents' city?" is exactly the
    // question residents ask; the technical tabs (Analysis, Interventions, AI + Export) stay
    // Authority-only. AGNI is still reachable for citizens via the floating button.
    const TABS = citizen ? ['Overview', 'What to do', 'Compare'] : ['Overview', 'Analysis', 'Compare', 'Interventions', 'AI + Export']
    const TAB_LABELS = {
      'What to do': t('tabs.whatToDo', 'WHAT TO DO'),
      'Overview': t('tabs.overview', 'OVERVIEW'),
      'Analysis': t('tabs.analysis', 'ANALYSIS'),
      'Compare': t('tabs.compare', 'COMPARE'),
      'Interventions': t('tabs.interventions', 'INTERVENTIONS'),
      'AI + Export': t('tabs.aiExport', 'AI + EXPORT')
    }

          return (
            <div style={{ display: screen === 'dashboard' ? 'contents' : 'none' }}>
      {/* Theme colour = the selected city's LIVE current temperature; the seeded `lst` is only
          the fallback before the live reading arrives (it was the cause of e.g. Lucknow at 28°C
          showing a red theme because the seed followed the state's bucket). */}
      <div className="dashboard-container" style={getThemeVars(typeof liveWeather?.current?.temp === 'number' ? liveWeather.current.temp : lst)}>
        {liveWeather?.demoOverride != null && (
          <div data-testid="demo-banner" style={{
            position: 'fixed', bottom: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 4000,
            background: 'rgba(124,45,18,0.95)', border: '1px solid #f59e0b', color: '#fde68a',
            borderRadius: 999, padding: '6px 16px', fontSize: 12, fontWeight: 700, boxShadow: '0 4px 14px rgba(0,0,0,0.4)'
          }}>
            🧪 DEMO — {liveWeather.demoOverrideCity || 'this city'} forced to {liveWeather.demoOverride}°C via the ?demo / ?demoTemp URL parameter (this browser only, not real data). Remove it to return to live readings.
          </div>
        )}
        {/* Floating AI Assistant — quick access from any dashboard tab without
            switching to AI+Export, reuses the same AIAnalystPanel/state.
            Suppressed on the AI+Export tab itself: that tab already renders
            the full AGNI panel inline, so the floating shortcut is a
            redundant, fixed-position duplicate there — confirmed it visually
            covered the suggestion chips/input of the tab's own AGNI panel at
            375px (its bottom:16/right:16 position coincides with where that
            panel's pinned input bar naturally sits). */}
        {activeTab !== 'AI + Export' && (
          <FloatingAIAssistant
          audience={audience}
          lite={lite}
          onLiteChange={setLite}
            cityName={selectedCity}
            ensoPhase={ensoPhase}
            lst={realSurfaceTemp}
            ndvi={realLulcEntry?.vegetation ?? null}
            ndbi={realLulcEntry?.builtUp ?? null}
            aqi={liveWeather?.aqi?.usAQI}
            chatHistory={chatHistory}
            setChatHistory={setChatHistory}
            aiLoading={aiLoading}
            setAiLoading={setAiLoading}
            selectedQuestion={selectedQuestion}
            setSelectedQuestion={setSelectedQuestion}
            questionDropOpen={questionDropOpen}
            setQuestionDropOpen={setQuestionDropOpen}
          />
        )}

        {/* Dashboard navbar */}
        <nav className="navbar">
          <div className="nav-left">
            <button onClick={() => setScreen("map")} className="nav-btn">← {t('nav.backToMap', 'Back to Map')}</button>
            <h2>{selectedCity}, {selectedState}</h2>
          </div>
          <div className="nav-right">
            <AudienceToggle audience={audience} onChange={setAudience} size="md" />
            <ViewModeToggle mode={viewMode} onChange={setViewMode} size="md" />
            <LanguageDropdown />
            <div className="avatar">{userName[0]?.toUpperCase() || 'K'}</div>
            <button onClick={() => {setScreen("signin"); setUserName("")}} className="nav-btn">{t('nav.signOut', 'Sign Out')}</button>
          </div>
        </nav>

        {/* Dashboard tab bar — horizontally scrollable with fade hints on
            whichever edge(s) still have hidden tabs, so a narrow screen doesn't
            just silently clip INTERVENTIONS/AI+EXPORT with no sign they exist. */}
        {viewMode === 'compact' ? (
          /* Mobile layout: one native dropdown instead of a horizontally scrolling tab row */
          <div style={{ background: '#0a0f1e', borderBottom: '1px solid #1a2a4a', padding: '8px 12px' }}>
            <select
              aria-label="Dashboard section"
              value={activeTab}
              onChange={e => setActiveTab(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', background: '#0f172a', color: '#d97706', border: '1px solid rgba(217,119,6,0.5)', borderRadius: 8 }}
            >
              {TABS.map(tab => <option key={tab} value={tab}>{TAB_LABELS[tab]}</option>)}
            </select>
          </div>
        ) : (
        <div style={{ position: 'relative', background: '#0a0f1e', borderBottom: '1px solid #1a2a4a' }}>
          <div
            ref={tabBarScrollRef}
            onScroll={updateTabBarOverflow}
            className="tab-bar-scroll"
            style={{
              display: 'flex',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              padding: '0 16px'
            }}
          >
            {TABS.map(tab => (
              <button
                key={tab}
                className="tab-btn"
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '12px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid var(--theme-accent)' : '2px solid transparent',
                  color: activeTab === tab ? 'var(--theme-accent)' : '#475569',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  cursor: 'pointer',
                  borderRadius: '4px 4px 0 0',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
          {tabBarOverflow.left && (
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: 28,
              background: 'linear-gradient(90deg, #0a0f1e, transparent)',
              pointerEvents: 'none'
            }} />
          )}
          {tabBarOverflow.right && (
            <div style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: 28,
              background: 'linear-gradient(270deg, #0a0f1e, transparent)',
              pointerEvents: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              color: '#475569', fontSize: 14, paddingRight: 2
            }}>›</div>
          )}
        </div>
        )}

        <div className="dashboard-scroll">
          {(activeTab === 'Overview' || activeTab === 'What to do') && (
            <div className="dashboard-content" data-citizen-tab={citizen ? activeTab : undefined}>
              <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
                {/* CITIZEN ONLY — share today's summary with family on WhatsApp (wa.me link,
                    pre-filled text; no backend). Authority view never renders this. */}
                {citizen && (() => {
                  const cs = citizenSummary || {}
                  const parts = [
                    `🌡️ Heat update for ${selectedCity}${selectedState ? ', ' + selectedState : ''}`,
                    cs.temp != null ? `Temperature: ${cs.temp}°C${cs.cached ? ' (cached reading)' : ''}` : null,
                    cs.risk ? `Heat risk: ${cs.risk}` : null,
                    cs.aqiLabel ? `Air quality: ${String(cs.aqiLabel).replace(/^[^\w]+/, '')}` : null,
                    cs.tip ? `💡 ${cs.tip}` : null,
                    '',
                    'Shared from BhaskarOps — https://heatops.vercel.app'
                  ].filter(x => x !== null)
                  const waHref = `https://wa.me/?text=${encodeURIComponent(parts.join('\n'))}`
                  return (
                    <section className="panel" data-panel="SHARE" style={{ padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>
                          <strong style={{ color: '#f8fafc' }}>{t('citizen.shareTitle', 'Warn family & friends')}</strong>
                          <div style={{ color: '#94a3b8' }}>{t('citizen.shareSub', "Sends today's temperature, risk level and safety tip for {{city}} as a WhatsApp message.", { city: selectedCity })}</div>
                        </div>
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="whatsapp-share"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#15803d', color: '#f8fafc', border: '1px solid rgba(34,197,94,0.6)', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}
                        >
                          📤 {t('citizen.shareButton', 'Share with family')}
                        </a>
                      </div>
                    </section>
                  )
                })()}

                {/* CITIZEN ONLY — Safe hours today, derived from the hourly "feels like" forecast the
                    WeatherCard already loads (no new data). One status line + one bar with the
                    day's windows labelled on it. 🔴 ≥ 40°C avoid · 🟡 35–39°C only if necessary ·
                    🟢 < 35°C safe. */}
                {citizen && (() => {
                  const hourly = Array.isArray(liveWeather?.hourly) ? liveWeather.hourly.slice(0, 24) : []
                  const zoneOf = (h) => {
                    const v = typeof h?.feelsLike === 'number' ? h.feelsLike : h?.temp
                    if (typeof v !== 'number') return null
                    return v >= 40 ? 'red' : v >= 35 ? 'yellow' : 'green'
                  }
                  const ZONE = {
                    red: { color: '#dc2626', bg: 'rgba(185,28,28,0.55)', dot: '🔴', label: t('citizen.hours.avoid', 'Avoid stepping out') },
                    yellow: { color: '#eab308', bg: 'rgba(202,138,4,0.55)', dot: '🟡', label: t('citizen.hours.onlyIfNeeded', 'Only go out if necessary') },
                    green: { color: '#22c55e', bg: 'rgba(21,128,61,0.55)', dot: '🟢', label: t('citizen.hours.safe', 'Safe to go outside') }
                  }
                  const zones = hourly.map(zoneOf)
                  const nowHour = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' })) % 24
                  const fmtHour = (i) => (i === 0 || i === 24 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i - 12}pm`)
                  const runs = []
                  zones.forEach((z, i) => { const last = runs[runs.length - 1]; if (last && last.zone === z) last.end = i; else runs.push({ zone: z, start: i, end: i }) })
                  const nowZone = zones[nowHour] || null
                  const nowRun = runs.find(r => nowHour >= r.start && nowHour <= r.end)
                  return (
                    <section className="panel" data-panel="SAFEHOURS" style={{ padding: 16 }}>
                      <h3 style={{ marginBottom: 8 }}>🕒 {t('citizen.hours.title', 'Safe hours today')}</h3>
                      {hourly.length < 12 ? (
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('citizen.hours.unavailable', 'Hourly forecast is not available right now — treat 12–4 pm as the riskiest window and prefer early morning or evening.')}</div>
                      ) : (
                        <>
                          <div data-testid="safe-hours-now" style={{ fontSize: 15, fontWeight: 800, color: nowZone ? ZONE[nowZone].color : '#e2e8f0', marginBottom: 10 }}>
                            {nowZone ? `${ZONE[nowZone].dot} ${t('citizen.hours.rightNow', 'Right now')}: ${ZONE[nowZone].label}` : t('citizen.hours.rightNowUnknown', 'Right now: no forecast for this hour')}
                            {nowRun && <span style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8', marginLeft: 8 }}>({t('citizen.hours.until', 'until')} {fmtHour(nowRun.end + 1)})</span>}
                          </div>
                          <div data-testid="safe-hours-bar" style={{ display: 'flex', width: '100%', height: 22, borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.25)' }}>
                            {runs.map((r, i) => (
                              <div key={i} data-zone={r.zone || 'none'} title={`${fmtHour(r.start)}–${fmtHour(r.end + 1)}: ${r.zone ? ZONE[r.zone].label : 'no data'}`}
                                style={{ flex: `${r.end - r.start + 1} 0 0`, background: r.zone ? ZONE[r.zone].bg : 'rgba(148,163,184,0.2)', borderRight: i < runs.length - 1 ? '1px solid rgba(15,23,42,0.6)' : 'none' }} />
                            ))}
                          </div>
                          {/* Windows in reading order — wraps on narrow screens instead of truncating */}
                          <div data-testid="safe-hours-labels" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 6, fontSize: 11 }}>
                            {runs.filter(r => r.zone).map((r, i) => (
                              <span key={i} style={{ color: ZONE[r.zone].color, whiteSpace: 'nowrap' }}>
                                {ZONE[r.zone].dot} {fmtHour(r.start)}–{fmtHour(r.end + 1)}
                              </span>
                            ))}
                          </div>
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 8 }}>{t('citizen.hours.keyShort', '🟢 safe · 🟡 only if necessary · 🔴 avoid — today\'s hourly "feels like" forecast, {{city}}', { city: selectedCity })}</div>
                        </>
                      )}
                    </section>
                  )
                })()}

                {/* PANEL A: Weather Conditions — single source of truth is the live Open-Meteo WeatherCard.
                    The old static/estimated Temperature/Humidity/Wind/AQI cards (Landsat/ERA5/CPCB-labeled
                    placeholder values) have been removed entirely per data-accuracy fix. */}
                <section className="panel" data-panel="A">
                  <h3><PanelIcon name="thermometer" /> {t('panels.weatherConditions', 'WEATHER CONDITIONS')}</h3>
                  <WeatherCard city={selectedCity} state={selectedState} onClose={() => {}} simpleAqi={citizen} />
                  {/* Year-over-year comparison — additive stat, derived from existing 10-year trend data */}
                  {/* The former "same date last year" line was a formula (today − an assumed annual slope), not a
                    reading — removed. Real history lives in the 30-day trend panel below; a true
                    year-over-year comparison arrives with the NASA MODIS 2016–2026 archive. */}
                </section>

                {/* PANEL G: Day vs Night */}
                {/* 30-day trend from the platform's own daily archive — visible to both audiences */}
                <CityTrendPanel city={selectedCity} state={selectedState} liveTemp={liveWeather?.current?.temp} />

                <section className="panel" data-panel="G">
                  <h3><PanelIcon name="sun-moon" /> {t('panels.todayHighLow', "TODAY'S HIGH vs LOW")}</h3>
                  {/* Real forecast high/low for today from the same Open-Meteo call the WeatherCard
                      uses. (This panel used to print seed + 3 / seed − 8 — "50.8 °C / 47.2 °C" for
                      a 27 °C city.) Bars are proportional to a 0–50 °C scale. */}
                  {typeof liveWeather?.today?.maxTemp === 'number' && typeof liveWeather?.today?.minTemp === 'number' ? (
                    <div className="comparison-bar">
                      <div className="bar-item">
                        <span>{t('dayNight.high', "Today's high (forecast)")}</span>
                        <div className="bar" style={{ background: '#c2410c', width: `${Math.max(4, Math.min(100, liveWeather.today.maxTemp * 2))}%` }} />
                        <span data-testid="today-high">{liveWeather.today.maxTemp}°C</span>
                      </div>
                      <div className="bar-item">
                        <span>{t('dayNight.low', "Today's low (forecast)")}</span>
                        <div className="bar" style={{ background: '#2563eb', width: `${Math.max(4, Math.min(100, liveWeather.today.minTemp * 2))}%` }} />
                        <span data-testid="today-low">{liveWeather.today.minTemp}°C</span>
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>{t('dayNight.source', 'Source: Open-Meteo daily forecast for this city (same reading as the weather card).')}</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('cityList.noLiveData', 'NO LIVE DATA')}</div>
                  )}
                </section>
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
                {/* PANEL B: Satellite Indices — every card below shows either a real, live
                    value or an explicit "not available" state. Nothing here is estimated/
                    seeded; see the Random Forest panel disclosure for the same standard
                    applied to the ML model. */}
                <section className="panel" data-panel="B">
                  <h3><PanelIcon name="satellite" /> {t('panels.satelliteIndices', 'SATELLITE INDICES')}</h3>
                  <div className="indices-grid">
                    <div className="index-card">
                      <span>{t('satelliteIndices.surfaceTempLive', 'Surface Temp (live)')}</span>
                      {typeof liveWeather?.current?.surfaceTemp === 'number' ? (
                        <>
                          <div className="progress-bar">
                            <div className="progress" style={{width: (liveWeather.current.surfaceTemp/55)*100 + '%', background:'linear-gradient(90deg, #0a6638, #896e00, #bb5200, #b81010)'}}/>
                          </div>
                          <span className="index-value">{typeof liveWeather.current.surfaceTemp === 'number' ? `${liveWeather.current.surfaceTemp.toFixed(1)}°C` : '—'}</span>
                          <SourceBadge source="Open-Meteo surface/skin temperature (live weather model)" />
                          <div style={{fontSize: 9, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginTop: 2}}>
                            ℹ️ {t('satellitePass.modeledNote', 'Modeled ground-surface temperature, not a satellite-measured Landsat reading — updates live, unlike a ~16-day satellite revisit.')}
                          </div>
                        </>
                      ) : (liveWeatherError || liveWeatherTimedOut) ? (
                        <span style={{fontSize: 11, color: '#ff6b6b'}}>⚠️ {t('satellitePass.unavailable', 'Live data unavailable')}</span>
                      ) : (
                        <span style={{fontSize: 11, color: 'rgba(255,255,255,0.4)'}}>{t('satellitePass.loading', 'Loading live surface data…')}</span>
                      )}
                    </div>
                    {(() => {
                      const lulcEntry = getLulcWithFallback(selectedCity, selectedState, lulcReal, cityCoordsData)
                      if (!lulcEntry) {
                        return (
                          <div className="index-card">
                            <span>{t('satelliteIndices.ndviNdbiNdwi', 'NDVI / NDBI / NDWI')}</span>
                            <div style={{fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 6, lineHeight: 1.5}}>
                              {t('satellitePass.lulcNotAvailable', 'Not available for {{city}} — real classification only computed for one representative city per state so far.', { city: selectedCity })}
                            </div>
                          </div>
                        )
                      }
                      const fallbackSuffix = lulcEntry.isFallback
                        ? ` · est. from ${lulcEntry.fallbackCity}${lulcEntry.distanceKm != null ? ` (~${lulcEntry.distanceKm}km)` : ''}`
                        : ''
                      return (
                        <>
                          {lulcEntry.isFallback && (
                            <div className="index-card" style={{gridColumn: '1 / -1'}}>
                              <div style={{fontSize: 10, color: 'rgba(234,179,8,0.85)', lineHeight: 1.5}}>
                                📍 {t('satellitePass.lulcFallback', 'No real classification for {{city}} itself — showing nearest available real data point ({{fallbackCity}}) below, as an estimate.', { city: selectedCity, fallbackCity: lulcEntry.fallbackCity })}
                              </div>
                            </div>
                          )}
                          <div className="index-card">
                            <span>{t('satelliteIndices.vegetationFraction', 'Vegetation Fraction')}</span>
                            <div className="progress-bar">
                              <div className="progress" style={{width: lulcEntry.vegetation + '%', background:'#15803d'}}/>
                            </div>
                            <span className="index-value">{lulcEntry.vegetation}%</span>
                            <SourceBadge source={`ESA WorldCover 10m (2021) — real proxy for NDVI, not the spectral index itself${fallbackSuffix}`} />
                          </div>
                          <div className="index-card">
                            <span>{t('satelliteIndices.builtUpFraction', 'Built-up Fraction')}</span>
                            <div className="progress-bar">
                              <div className="progress" style={{width: lulcEntry.builtUp + '%', background:'#c2410c'}}/>
                            </div>
                            <span className="index-value">{lulcEntry.builtUp}%</span>
                            <SourceBadge source={`ESA WorldCover 10m (2021) — real proxy for NDBI, not the spectral index itself${fallbackSuffix}`} />
                          </div>
                          <div className="index-card">
                            <span>{t('satelliteIndices.waterFraction', 'Water Fraction')}</span>
                            <div className="progress-bar">
                              <div className="progress" style={{width: Math.min(100, lulcEntry.water * 3) + '%', background:'#3b82f6'}}/>
                            </div>
                            <span className="index-value">{lulcEntry.water}%</span>
                            <SourceBadge source={`ESA WorldCover 10m (2021) — real proxy for NDWI, not the spectral index itself${fallbackSuffix}`} />
                          </div>
                        </>
                      )
                    })()}
                    <div className="index-card">
                      <span>{t('satelliteIndices.elevation', 'Elevation')}</span>
                      {typeof liveWeather?.elevation === 'number' ? (
                        <>
                          <div className="progress-bar">
                            <div className="progress" style={{width: Math.min(100, (liveWeather.elevation/3000)*100) + '%', background:'#888'}}/>
                          </div>
                          <span className="index-value">{typeof liveWeather.elevation === 'number' ? `${Math.round(liveWeather.elevation)}m` : '—'}</span>
                          <SourceBadge source="SRTM 30m DEM (via Open-Meteo Elevation API)" />
                        </>
                      ) : (liveWeatherError || liveWeatherTimedOut) ? (
                        <span style={{fontSize: 11, color: '#ff6b6b'}}>⚠️ {t('satellitePass.unavailable', 'Live data unavailable')}</span>
                      ) : (
                        <span style={{fontSize: 11, color: 'rgba(255,255,255,0.4)'}}>{t('satellitePass.loading', 'Loading live surface data…')}</span>
                      )}
                    </div>
                  </div>
                </section>

                {/* PANEL D: Heat Risk Gauge */}
                <section className="panel" data-panel="D">
                  <h3><PanelIcon name="gauge" /> {t('panels.heatRiskGauge', 'HEAT RISK GAUGE')}</h3>
                  <div className="gauge-container">
                    <svg width="200" height="120" viewBox="0 0 200 120">
                      {GAUGE_SEGMENTS.map((seg) => {
                        const from = gaugePoint(gaugeAngleDeg(seg.from))
                        const to = gaugePoint(gaugeAngleDeg(seg.to))
                        return (
                          <path
                            key={seg.color}
                            d={`M ${from.x} ${from.y} A ${GAUGE_RADIUS} ${GAUGE_RADIUS} 0 0 1 ${to.x} ${to.y}`}
                            fill="none" stroke={seg.color} strokeWidth="8"
                          />
                        )
                      })}
                      {/* Needle + label both driven by ONE value so they can never
                          disagree: the city's own live current temp, else the state's
                          live avg (same source as the map colors), else the illustrative
                          per-city lst — with the fallback tiers labeled honestly. */}
                      {(() => {
                        const sd = liveIndiaData[selectedState]
                        const gaugeVal = typeof liveWeather?.current?.temp === 'number' ? liveWeather.current.temp
                          : (sd?.heatIndexLive ? sd.heatIndex : lst)
                        const tip = gaugePoint(gaugeAngleDeg(gaugeVal), 65)
                        return <line x1={GAUGE_CENTER.x} y1={GAUGE_CENTER.y} x2={tip.x} y2={tip.y} stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
                      })()}
                      <circle cx={GAUGE_CENTER.x} cy={GAUGE_CENTER.y} r="5" fill="#fff"/>
                    </svg>
                    {(() => {
                      const sd = liveIndiaData[selectedState]
                      const isCityLive = typeof liveWeather?.current?.temp === 'number'
                      const gaugeVal = isCityLive ? liveWeather.current.temp
                        : (sd?.heatIndexLive ? sd.heatIndex : lst)
                      const isLive = isCityLive || sd?.heatIndexLive
                      // Label + dot use the SAME four tiers as the theme colours (UI_THEME_BUCKETS),
                      // so the heading colour and the gauge readout can never disagree.
                      const tier = UI_THEME_BUCKETS.find(b => gaugeVal >= b.min)
                      const label = tier.label.toUpperCase()
                      const icon = { Extreme: '🔴', High: '🟠', Moderate: '🟡', Low: '🟢' }[tier.label] || '⚪'
                      return (
                        <div className="risk-label">
                          {icon} {label} · {gaugeVal}°C
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 400, marginTop: 2 }}>
                            {isCityLive ? 'live current temp (Open-Meteo)'
                              : isLive ? `live state median of ${sd.liveCityCount} cities`
                              : '(estimated)'}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </section>

                {/* PANEL K: Alerts */}
                <section className="panel" data-panel="K">
                  <h3><PanelIcon name="siren" /> {t('panels.activeAlerts', 'ACTIVE ALERTS')} ({alerts.length})</h3>
                  <div className="alerts-list">
                    {alerts.map(alert => (
                      <div key={alert.id} className="alert-item" style={{borderLeftColor: alert.color}}>
                        <span className="alert-icon">{alert.icon}</span>
                        <span className="alert-text">{alert.text}</span>
                        <button onClick={() => setAlerts(alerts.filter(a => a.id !== alert.id))} className="alert-close">×</button>
                      </div>
                    ))}
                  </div>
                </section>

                {/* AUTHORITY ONLY — operational Heatwave Action Checklist (HAP steps), ticks kept
                    locally per city so it works as a live tool in a demo. */}
                {!citizen && (
                  <HeatActionChecklist
                    city={selectedCity}
                    state={selectedState}
                    risk={citizenSummary?.risk}
                    temp={citizenSummary?.temp}
                    onOpenInterventions={() => setActiveTab('Interventions')}
                  />
                )}

                {/* PANEL S: Health & Safety Precautions — rules-based, no AI call, loads instantly.
                    Reads the SAME shared liveWeather (useWeather hook) as the Weather Conditions
                    panel — no separate fetch of its own — so it falls back to the same cached
                    value if the live fetch fails, and only ever shows "unavailable" if there is
                    truly no data (live or cached) at all for this city. */}
                {(() => {
                  const precautionTemp = liveWeather?.current?.temp
                  const precautionAqi = liveWeather?.aqi?.usAQI
                  const info = getPrecautionInfo(precautionTemp, precautionAqi)
                  return (
                    <section className="panel" data-panel="S" style={info ? { borderLeft: `4px solid ${info.color}` } : undefined}>
                      <h3><PanelIcon name="stethoscope" /> {t('panels.healthSafety', 'HEALTH & SAFETY PRECAUTIONS')}</h3>
                      {info ? (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 700, color: info.color, marginBottom: 10, letterSpacing: '0.05em' }}>
                            {info.category} · {precautionTemp}°C
                            {liveWeatherStale && (
                              <span style={{ marginLeft: 10, fontSize: 10, fontWeight: 400, fontStyle: 'italic', color: 'rgba(255,200,100,0.8)' }}>
                                ⏱ {t('weatherStatus.cachedMinAgo', 'Cached — {{mins}} min ago', { mins: Math.round((Date.now() - (liveWeatherCachedAt || Date.now())) / 60000) })}
                                <button
                                  onClick={forceRefreshLiveWeather}
                                  style={{
                                    marginLeft: 8, fontSize: 9, padding: '2px 8px', borderRadius: 4,
                                    background: 'rgba(255,200,100,0.1)', border: '1px solid rgba(255,200,100,0.3)',
                                    color: 'rgba(255,200,100,0.9)', cursor: 'pointer', fontWeight: 600, fontStyle: 'normal'
                                  }}
                                >↻ {t('weatherStatus.forceRefresh', 'Force Refresh')}</button>
                              </span>
                            )}
                          </div>
                          <ul style={{
                            fontFamily: "'Courier New', monospace",
                            fontSize: 12,
                            lineHeight: 1.7,
                            paddingLeft: 18,
                            margin: 0,
                            color: 'var(--text-light)'
                          }}>
                            {info.items.map((item, i) => <li key={i}>{t(`precautions.${info.groupKey}.${i}`, item)}</li>)}
                          </ul>
                          {/* Vulnerable population note — additive, text-based, no new data source */}
                          <div style={{
                            marginTop: 10,
                            paddingTop: 8,
                            borderTop: '1px solid rgba(255,255,255,0.08)',
                            fontSize: 11,
                            fontStyle: 'italic',
                            color: 'rgba(255,255,255,0.55)'
                          }}>
                            ⚠️ {t('precautions.vulnerableNote', 'Extra caution advised for elderly, children, and outdoor workers in this heat category')}
                          </div>
                        </>
                      ) : (liveWeatherError || liveWeatherTimedOut) ? (
                        <div style={{ fontSize: 12, color: '#ff6b6b' }}>
                          ⚠️ {t('weatherStatus.weatherUnavailable', 'Weather unavailable')}
                          <button
                            onClick={forceRefreshLiveWeather}
                            style={{
                              marginLeft: 10, fontSize: 11, padding: '4px 10px', borderRadius: 6,
                              background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.35)',
                              color: '#22c55e', cursor: 'pointer', fontWeight: 600
                            }}
                          >↻ {t('weatherStatus.forceRefresh', 'Force Refresh')}</button>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{t('satelliteIndices.loadingLiveTemp', 'Loading live temperature...')}</div>
                      )}
                    </section>
                  )
                })()}

                {/* CITIZEN ONLY — "How you can help your neighbourhood". SEVERITY-ADAPTIVE:
                    the list follows today's live risk bucket — full urgent list on Extreme/High,
                    a short list on Moderate, a positive all-clear on Low, and a distinct
                    cold-weather list below 10 °C (hill stations in winter). */}
                {citizen && activeTab === 'What to do' && (() => {
                  const risk = citizenSummary?.risk || 'Low'
                  const temp = citizenSummary?.temp
                  const tier = (typeof temp === 'number' && temp < 10) ? 'cold'
                    : (risk === 'Extreme' || risk === 'High') ? 'urgent'
                    : risk === 'Medium' ? 'moderate' : 'calm'
                  const urgent = tier === 'urgent'
                  const ITEM_SETS = {
                    urgent: [
                      { icon: '🧓', urgent: true, text: t('citizen.help.elderlyNow', 'Check on elderly and vulnerable neighbours NOW — a phone call or a knock during 12–4 pm can prevent heat stroke.') },
                      { icon: '💧', text: t('citizen.help.water', 'Identify and help maintain a public water point or a shaded resting spot in your locality.') },
                      { icon: '🏠', text: t('citizen.help.coolRoof', 'Spread the word about cool roofs and green cover in your building or society.') },
                      { icon: '📣', text: t('citizen.help.rwa', "Ask your local RWA / ward office about the city's Heat Action Plan and share it in your group.") },
                      { icon: '🪴', text: t('citizen.help.plants', 'Grow heat-resistant plants at home — Aloe Vera, Snake Plant, Money Plant or Neem saplings help cool your surroundings and are easy to maintain.') }
                    ],
                    moderate: [
                      { icon: '💧', text: t('citizen.help.hydrate', 'Stay hydrated through the day — carry water if you are out around midday.') },
                      { icon: '🧓', text: t('citizen.help.elderly', 'Keep an eye on elderly neighbours if they go out in the peak hours (12–4 pm).') },
                      { icon: '🪴', text: t('citizen.help.plants', 'Grow heat-resistant plants at home — Aloe Vera, Snake Plant, Money Plant or Neem saplings help cool your surroundings and are easy to maintain.') }
                    ],
                    cold: [
                      { icon: '🧥', urgent: true, text: t('citizen.help.coldDress', 'Dress warmly in layers, especially early morning and at night — cover hands, ears and head.') },
                      { icon: '🏠', text: t('citizen.help.coldHomeless', 'Check on homeless neighbours — help connect them to a night shelter if possible.') },
                      { icon: '🧓', text: t('citizen.help.coldElderly', 'Look in on elderly neighbours: unventilated heaters carry a carbon-monoxide risk.') },
                      { icon: '🪴', text: t('citizen.help.coldPlants', 'Protect outdoor plants and exposed water pipes from frost overnight.') }
                    ],
                    calm: []
                  }
                  const list = ITEM_SETS[tier]
                  const accent = tier === 'urgent' ? '#dc2626' : tier === 'cold' ? '#2563eb' : null
                  return (
                    <section className="panel" data-panel="HELP" data-help-tier={tier} style={accent ? { borderLeft: `4px solid ${accent}` } : undefined}>
                      <h3><PanelIcon name={tier === 'cold' ? 'snowflake' : 'heart-handshake'} /> {t('citizen.help.title', 'How you can help your neighbourhood')}</h3>
                      {urgent && (
                        <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 700, marginBottom: 8 }}>
                          {t('citizen.help.urgentNote', '{{risk}} heat risk today — the first step matters most.', { risk })}
                        </div>
                      )}
                      {tier === 'cold' && (
                        <div style={{ fontSize: 12, color: '#60a5fa', fontWeight: 700, marginBottom: 8 }}>
                          {t('citizen.help.coldNote', 'Cold conditions today ({{temp}}°C) — the risks flip: warmth, not shade.', { temp })}
                        </div>
                      )}
                      {tier === 'calm' ? (
                        <div data-testid="help-calm" style={{ fontSize: 13, color: '#86efac', lineHeight: 1.6, padding: '10px 12px', background: 'rgba(21,128,61,0.10)', border: '1px solid rgba(21,128,61,0.35)', borderRadius: 8 }}>
                          🌤️ {t('citizen.help.calm', 'Great weather today — safe to be outdoors, no special precautions needed. A good day to plant a sapling or check that your building\'s water point works.')}
                        </div>
                      ) : (
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {list.map((it, i) => (
                            <li key={i} style={{
                              display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12, lineHeight: 1.5, padding: '8px 10px', borderRadius: 8,
                              background: it.urgent && urgent ? 'rgba(185,28,28,0.12)' : it.urgent && tier === 'cold' ? 'rgba(37,99,235,0.12)' : 'rgba(148,163,184,0.06)',
                              border: `1px solid ${it.urgent && urgent ? 'rgba(185,28,28,0.5)' : it.urgent && tier === 'cold' ? 'rgba(37,99,235,0.5)' : 'rgba(148,163,184,0.15)'}`,
                              color: it.urgent && urgent ? '#fecaca' : it.urgent && tier === 'cold' ? '#bfdbfe' : '#e2e8f0', fontWeight: it.urgent && (urgent || tier === 'cold') ? 700 : 400
                            }}>
                              <span style={{ fontSize: 16 }}>{it.icon}</span>
                              <span>{it.text}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  )
                })()}

                {/* Citizen "What to do": a simple AGNI box next to the safety precautions */}
                {citizen && activeTab === 'What to do' && (
                  <section className="panel" data-panel="AGNI-citizen">
                    <h3><PanelIcon name="bot" /> {t('panels.askAgni', 'ASK AGNI — is it safe today?')}</h3>
                    <AIAnalystPanel
                        cityName={selectedCity}
                        stateName={selectedState}
                        ensoPhase={ensoPhase}
                        lst={realSurfaceTemp}
                        ndvi={realLulcEntry?.vegetation ?? null}
                        ndbi={realLulcEntry?.builtUp ?? null}
                        aqi={liveWeather?.aqi?.usAQI}
                        chatHistory={chatHistory}
                        setChatHistory={setChatHistory}
                        aiLoading={aiLoading}
                        setAiLoading={setAiLoading}
                        selectedQuestion={selectedQuestion}
                        setSelectedQuestion={setSelectedQuestion}
                        questionDropOpen={questionDropOpen}
                        setQuestionDropOpen={setQuestionDropOpen}
                      audience="citizen"
                    />
                  </section>
                )}

                {/* PANEL J: Climate Oscillations */}
                <section className="panel" data-panel="J">
                  <h3><PanelIcon name="globe" /> {t('panels.climateOscillations', 'GLOBAL CLIMATE SYSTEMS')}</h3>
                  <div className="climate-grid">
                    <div className="climate-card">
                      <strong>{t('climate.enso', 'ENSO')}:</strong> {t(`climate.values.${ensoPhase}`, ensoPhase)}
                    </div>
                    <div className="climate-card">
                      <strong>{t('climate.iod', 'IOD')}:</strong> {t('climate.values.Positive Phase', 'Positive Phase')}
                    </div>
                    <div className="climate-card">
                      <strong>{t('climate.mjo', 'MJO')}:</strong> Phase {mjoPhase}
                    </div>
                    <div className="climate-card">
                      <strong>{t('climate.pdo', 'PDO')}:</strong> {t('climate.values.Warm Phase', 'Warm Phase')}
                    </div>
                    <div className="climate-card">
                      <strong>{t('climate.nao', 'NAO')}:</strong> Positive +1.2
                    </div>
                    <div className="climate-card">
                      <strong>{t('climate.polarVortex', 'Polar Vortex')}:</strong> {t(`climate.values.${polarVortex}`, polarVortex)}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'Analysis' && (
            <div className="dashboard-content">
              <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
                {/* PANEL E: Heatmap Grid with Dynamic Updates */}
                <section className="panel">
                  <h3><PanelIcon name="flame" /> {t('panels.heatmapGrid', 'TEMPERATURE HEATMAP GRID')}</h3>
                  {showGridUpdatedBadge && (
                    <div
                      data-testid="grid-updated-badge"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10,
                        background: 'rgba(217,119,6,0.12)', border: '1px solid rgba(217,119,6,0.5)',
                        color: '#d97706', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700,
                        animation: 'tabFadeIn 0.25s ease'
                      }}
                    >
                      ✨ {t('interventions.gridUpdated', 'Updated based on your intervention settings')}
                    </div>
                  )}
                  <div data-testid="grid-base" style={{ marginBottom: 8, fontSize: 11, color: gridBaseSource === 'seed' ? '#f59e0b' : '#94a3b8' }}>
                    📡 {gridBaseLabel} · {t('grid.patternNote', 'the ±2 °C cell-to-cell variation is an illustrative intra-city pattern, not measured')}
                  </div>
                  <div style={{marginBottom: "12px", fontSize: "11px", color: "rgba(255,255,255,0.6)"}}>
                    🌳 {t('physics.items.urbanGreening', 'Urban Greening')}: <strong>{(treeSlider*18).toFixed(1)}°C</strong> | 🏠 {t('physics.items.coolRoofs', 'Cool Roofs')}: <strong>{(roofSlider*14).toFixed(1)}°C</strong> | 💧 {t('physics.items.waterBodies', 'Water Bodies')}: <strong>{(waterSlider*12).toFixed(1)}°C</strong>
                  </div>
                  <div className="heatmap-section">
                    <div className="grid-heatmap">
                      {Array.from({length:100}).map((_, i) => {
                        const row = Math.floor(i / 10)
                        const col = i % 10
                        const cellTemp = getCellTemp(gridBase, row, col, treeSlider, roofSlider, waterSlider)
                        // Same thresholds/colours as computeInterventionImpact() on the Interventions tab
                        const color = getGridBucket(cellTemp).color

                        return (
                          <div
                            key={i}
                            className="heatmap-cell"
                            style={{background: color, opacity: 0.85}}
                            title={cellTemp.toFixed(1) + '°C'}
                          >
                            {cellTemp.toFixed(0)}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </section>

                {/* PANEL K: GEE Pipeline */}
                <GEEPipelinePanel />
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
                {/* PANEL C: ML Model Panel */}
                <SatelliteLstPanel city={selectedCity} state={selectedState} liveTemp={liveWeather?.current?.temp} />

                <MLModelPanel mlModel={mlModelReal} cityName={selectedCity} loadError={mlModelError} onRetry={retryMlModel} />

                {/* PANEL L: Land Use / Land Cover */}
                <LandCoverPanel lulcData={lulcReal} cityName={selectedCity} stateName={selectedState} coordsData={cityCoordsData} loadError={lulcError} onRetry={retryLulc} />

                {/* PANEL M: Urban Morphology (OpenStreetMap, live, real) */}
                <section className="panel">
                  <h3><PanelIcon name="building" /> {t('panels.urbanMorphology', 'URBAN MORPHOLOGY')}</h3>
                  {osmStatus === 'loading' ? (
                    <div style={{fontSize: 11, color: 'rgba(255,255,255,0.5)'}}>{t('osm.loading', 'Querying OpenStreetMap…')}</div>
                  ) : osmStatus === 'error' || !osmDensity ? (
                    <div style={{fontSize: 11, color: 'rgba(255,255,255,0.5)'}}>
                      {t('osm.unavailable', 'Building density unavailable right now — OpenStreetMap\'s free Overpass API is a shared community resource with no uptime guarantee.')}
                    </div>
                  ) : (
                    <>
                      <div style={{display: 'flex', gap: 16, marginBottom: 8}}>
                        <div>
                          <div style={{fontSize: 22, fontWeight: 700, color: '#d97706'}}>{osmDensity.buildingCount}</div>
                          <div style={{fontSize: 10, color: 'rgba(255,255,255,0.5)'}}>{t('osm.buildings', 'buildings within {{radius}}m', {radius: osmDensity.radiusM})}</div>
                        </div>
                        <div>
                          <div style={{fontSize: 22, fontWeight: 700, color: '#d97706'}}>{osmDensity.densityPerSqKm}</div>
                          <div style={{fontSize: 10, color: 'rgba(255,255,255,0.5)'}}>{t('osm.perSqKm', 'buildings / km²')}</div>
                        </div>
                      </div>
                      <SourceBadge source="OpenStreetMap (Overpass API, live)" />
                    </>
                  )}
                </section>

                {/* PANEL H: Historical Trend */}

                

              </div>
            </div>
          )}

          {activeTab === 'Compare' && (
            <div className="dashboard-content">
              <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
                <CompareCitiesPanel
                  selectedCity={selectedCity}
                  selectedState={selectedState}
                  liveWeather={liveWeather}
                  allCities={ALL_CITIES_FLAT}
                />
              </div>
            </div>
          )}

          {activeTab === 'Interventions' && (
            <div className="dashboard-content">
              <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
                {/* Recommended plan: how far this city's green cover is from the 30 % canopy
                    target of the 3-30-300 urban-forestry rule (Konijnendijk, 2021 — adopted by
                    WHO-Europe / UNECE guidance), and a one-click way to set the sliders to it.
                    Green cover comes from ESA WorldCover (own city or nearest classified city,
                    labelled); the projected cooling is the same illustrative slider model as the
                    grid, and says so. */}
                {(() => {
                  const lulc = getLulcWithFallback(selectedCity, selectedState, lulcReal, cityCoordsData)
                  // Tree canopy (ESA class 10 only) is what the 3-30-300 rule measures; use it when
                  // the classification has it, and fall back to total vegetation (trees + grass +
                  // crops) only for entries classified before treeCover was added.
                  const canopy = typeof lulc?.treeCover === 'number' ? lulc.treeCover : null
                  const veg = typeof lulc?.vegetation === 'number' ? lulc.vegetation : null
                  const green = canopy ?? veg
                  const usingCanopy = canopy != null
                  const built = typeof lulc?.builtUp === 'number' ? lulc.builtUp : (typeof lulc?.built_up === 'number' ? lulc.built_up : null)
                  const TARGET = 30
                  const gap = green == null ? null : Math.max(0, TARGET - green)
                  const recTree = gap == null ? 0 : Math.min(0.3, Math.round(gap) / 100)
                  const recRoof = built == null ? 0.1 : built >= 40 ? 0.2 : built >= 25 ? 0.15 : 0.1
                  const recCooling = recTree * 18 + recRoof * 14
                  const source = lulc ? (lulc.isFallback
                    ? t('plan.sourceFallback', 'ESA WorldCover — nearest classified city {{fb}}, {{km}} km away', { fb: lulc.fallbackCity, km: lulc.distanceKm })
                    : t('plan.sourceOwn', 'ESA WorldCover 10 m, {{city}}', { city: selectedCity })) : null
                  const applied = gap != null && Math.abs(treeSlider - recTree) < 0.005 && Math.abs(roofSlider - recRoof) < 0.005
                  return (
                    <section className="panel" data-testid="recommended-plan" style={{ borderLeft: `4px solid ${gap === 0 ? '#22c55e' : '#d97706'}` }}>
                      <h3><PanelIcon name="target" /> {t('plan.title', 'RECOMMENDED PLAN FOR {{city}}', { city: (selectedCity || '').toUpperCase() })}</h3>
                      {green == null ? (
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('plan.noLulc', 'No land-cover classification available for this city yet, so no target can be computed.')}</div>
                      ) : (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 10 }}>
                            <div className="metric-card"><span className="metric-label">{usingCanopy ? t('plan.canopyNow', 'TREE CANOPY NOW (ESA class 10)') : t('plan.greenNow', 'VEGETATION NOW (trees + grass + crops)')}</span><span className="metric-value" data-testid="plan-green-now">{green}%</span></div>
                            <div className="metric-card"><span className="metric-label">{t('plan.target', 'CANOPY TARGET (3-30-300 RULE)')}</span><span className="metric-value">{TARGET}%</span></div>
                            <div className="metric-card"><span className="metric-label">{t('plan.gap', 'TO ADD')}</span><span className="metric-value" data-testid="plan-gap" style={{ color: gap === 0 ? '#22c55e' : '#d97706' }}>{gap === 0 ? '✓ met' : `+${gap.toFixed(0)} pp`}</span></div>
                            <div className="metric-card"><span className="metric-label">{t('plan.cooling', 'PROJECTED COOLING')}</span><span className="metric-value">−{recCooling.toFixed(1)}°C</span></div>
                          </div>
                          <div style={{ fontSize: 12, lineHeight: 1.6, color: '#e2e8f0' }}>
                            {gap === 0 && usingCanopy
                              ? t('plan.metCanopy', '{{city}} already has {{green}}% tree canopy in the ~10 km box around {{point}} — at or above the 30 % target. Protect it: the plan here is to keep existing trees and put cool roofs on the built-up share.', { city: selectedCity, green, point: lulc?.isFallback ? lulc.fallbackCity : selectedCity })
                              : gap === 0
                              ? t('plan.met', 'On paper {{city}} is above the 30 % target — ESA reads {{green}}% vegetation for the ~10 km box around {{point}}, but that counts grass and cropland too. In a dense locality the street-level tree canopy is usually far lower, so the plan here is: protect existing trees, add street trees where footpaths allow, and put cool roofs on the built-up share to cut heat now.', { city: selectedCity, green, point: lulc?.isFallback ? lulc.fallbackCity : selectedCity })
                              : t('plan.text', 'To bring {{city}} to the 30 % canopy that the 3-30-300 rule sets for heat-safe neighbourhoods, {{what}} needs to rise from {{green}}% to 30% (+{{gap}} percentage points), and reflective cool roofs should cover about {{roof}}% of the {{built}} built-up area. On this model that cools the grid by about {{cool}} °C — the difference between a High and a Moderate afternoon for outdoor workers and the elderly.', { city: selectedCity, what: usingCanopy ? 'tree canopy' : 'green cover', green, gap: gap.toFixed(0), roof: Math.round(recRoof * 100), built: built != null ? `${built}%` : '', cool: recCooling.toFixed(1) })}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                            <button
                              type="button"
                              data-testid="apply-plan"
                              disabled={applied}
                              onClick={() => { setTreeSlider(recTree); setRoofSlider(recRoof); setInterventionTouchedAt(Date.now()) }}
                              style={{ background: applied ? 'rgba(34,197,94,0.15)' : '#d97706', color: applied ? '#22c55e' : '#0f172a', border: applied ? '1px solid rgba(34,197,94,0.5)' : 'none', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 800, cursor: applied ? 'default' : 'pointer' }}
                            >
                              {applied ? t('plan.applied', '✓ Plan applied to the sliders') : t('plan.apply', 'Apply recommended plan →')}
                            </button>
                            <span style={{ fontSize: 10, color: '#64748b' }}>{source} · {t('plan.modelNote', 'cooling from the same illustrative slider model as the grid')}</span>
                          </div>
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 8, lineHeight: 1.5 }}>
                            {usingCanopy
                              ? <>📐 {t('plan.canopyNote', 'Tree canopy = ESA WorldCover 10 m class 10 ("tree cover") over a ~10 km box around the classified point (2021). The 30 % target is the "30" of the 3-30-300 rule (Konijnendijk, J. Forestry Research 2023) — neighbourhood tree canopy for health and heat; a 2024 Nature Communications audit of 8 global cities found fewer than 20 % of buildings meet it outside Singapore and Seattle. India\'s own planning norm is different in kind: URDPFI 2014 asks for 10–12 m² of open space per person.')}</>
                              : <>⚠️ {t('plan.canopyCaveat', 'ESA WorldCover\'s vegetation figure counts trees, grass and cropland together for a ~10 km box around the classified point; the 3-30-300 rule is about tree canopy in the neighbourhood itself. In a dense locality the real canopy is usually far below this figure, so treat the gap shown here as a minimum — a local tree survey gives the true number.')}</>}
                          </div>
                        </>
                      )}
                    </section>
                  )
                })()}

                {/* PANEL F: Intervention Sliders (kept — duplicate "Cooling Interventions" panel removed) */}
                <section className="panel">
                  <h3><PanelIcon name="sliders" /> {t('panels.interventionSliders', 'UHI INTERVENTIONS (Real-time cooling)')}</h3>
                  <div style={{display: "grid", gap: "14px"}}>
                    <div>
                      <label style={{fontSize: "12px", color: "#22c55e", fontWeight: "700"}}>
                        <PanelIcon name="leaf" size={12} color="currentColor" /> {t('sliders.urbanGreening', 'Urban Greening (NDVI +0.3):')} {(treeSlider*100).toFixed(0)}%
                      </label>
                      <input type="range" min="0" max="0.3" step="0.01" value={treeSlider}
                        onChange={e => { setTreeSlider(parseFloat(e.target.value)); setInterventionTouchedAt(Date.now()) }}
                        style={{width: "100%", marginTop: "6px"}}
                      />
                      <div style={{fontSize: "10px", color: "rgba(255,255,255,0.5)", marginTop: "4px"}}>
                        Cooling potential: {(treeSlider*18).toFixed(1)}°C
                      </div>
                    </div>
                    <div>
                      <label style={{fontSize: "12px", color: "#d97706", fontWeight: "700"}}>
                        <PanelIcon name="home" size={12} color="currentColor" /> {t('sliders.coolRoofs', 'Cool Roofs (Albedo +0.2):')} {(roofSlider*100).toFixed(0)}%
                      </label>
                      <input type="range" min="0" max="0.2" step="0.01" value={roofSlider}
                        onChange={e => { setRoofSlider(parseFloat(e.target.value)); setInterventionTouchedAt(Date.now()) }}
                        style={{width: "100%", marginTop: "6px"}}
                      />
                      <div style={{fontSize: "10px", color: "rgba(255,255,255,0.5)", marginTop: "4px"}}>
                        Cooling potential: {(roofSlider*14).toFixed(1)}°C
                      </div>
                    </div>
                    <div>
                      <label style={{fontSize: "12px", color: "#94a3b8", fontWeight: "700"}}>
                        <PanelIcon name="droplets" size={12} color="currentColor" /> {t('sliders.waterBodies', 'Water Bodies (NDWI +0.1):')} {(waterSlider*100).toFixed(0)}%
                      </label>
                      <input type="range" min="0" max="0.1" step="0.01" value={waterSlider}
                        onChange={e => { setWaterSlider(parseFloat(e.target.value)); setInterventionTouchedAt(Date.now()) }}
                        style={{width: "100%", marginTop: "6px"}}
                      />
                      <div style={{fontSize: "10px", color: "rgba(255,255,255,0.5)", marginTop: "4px"}}>
                        Cooling potential: {(waterSlider*12).toFixed(1)}°C
                      </div>
                    </div>
                  </div>

                  {/* Live preview of what these settings do to the Analysis tab's heatmap grid —
                      same getCellTemp() + bucket thresholds the grid renders with, so the user
                      doesn't have to switch tabs to confirm the effect. */}
                  {(() => {
                    const impact = computeInterventionImpact(gridBase, treeSlider, roofSlider, waterSlider)
                    const active = impact.totalCooling > 0
                    return (
                      <div
                        data-testid="intervention-preview"
                        style={{
                          marginTop: 14, padding: '10px 12px', borderRadius: 8,
                          background: active ? 'rgba(217,119,6,0.08)' : 'rgba(148,163,184,0.06)',
                          border: `1px solid ${active ? 'rgba(217,119,6,0.35)' : 'rgba(148,163,184,0.2)'}`,
                          fontSize: 11, lineHeight: 1.6, color: '#e2e8f0'
                        }}
                      >
                        <div style={{ fontWeight: 700, color: active ? '#d97706' : '#94a3b8', marginBottom: 2 }}>
                          📊 {t('interventions.previewTitle', 'Estimated impact on the Analysis heatmap grid')}
                        </div>
                        {!active ? (
                          <div style={{ color: '#94a3b8' }}>{t('interventions.previewIdle', 'Move a slider to preview its effect — the grid on the Analysis tab updates live with these settings.')}</div>
                        ) : (
                          <>
                            <div>
                              −{impact.totalCooling.toFixed(1)}°C {t('interventions.perCell', 'per cell')} · <strong>{impact.changed}</strong>/100 {t('interventions.cellsChange', 'cells move to a cooler category')}
                            </div>
                            {impact.transitions.length > 0 && (
                              <div style={{ color: '#cbd5e1' }}>
                                {impact.transitions.map(tr => `${tr.from} → ${tr.to}: ${tr.count}`).join(' · ')}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => setActiveTab('Analysis')}
                              style={{ marginTop: 6, background: 'transparent', border: '1px solid rgba(217,119,6,0.5)', color: '#d97706', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                            >
                              {t('interventions.viewGrid', 'View on Analysis tab →')}
                            </button>
                          </>
                        )}
                      </div>
                    )
                  })()}
                </section>

                {/* Cool Roof Awareness + ROI Calculator — reuses the roofSlider*14 formula above */}
                <CoolRoofCalculator />

                {/* PANEL I: Physics Explanation */}
                <PhysicsPanel cityData={cityData} />
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
                {/* PANEL J: Spatial Recommendation */}
                {/* City-level planner for the District Magistrate (the state-wide one is in the
                    state panel). Replaces the old "WHERE to intervene" box, whose zones, area and
                    ₹3 lakh/ha were canned text keyed off a baseline index — not city data. */}
                {!citizen && (
                  <MitigationPlanner
                    scope="city"
                    cityName={selectedCity}
                    stateName={selectedState}
                    cities={[selectedCity]}
                    liveCityCache={liveCityCache}
                    lulcReal={lulcReal}
                    cityCoordsData={cityCoordsData}
                  />
                )}

                {/* Wind & Atmosphere — LIVE values from the same Open-Meteo reading the
                    WeatherCard shows. (This panel used to print hardcoded "12 km/h, NE 45°,
                    1013 mb" next to a WeatherCard showing the real wind — fabricated numbers
                    are gone. The old "Pollen & Air Quality" panel was removed entirely: none
                    of our sources provide pollen data for India, so its levels were invented.) */}
                <section className="panel">
                  <h3><PanelIcon name="wind" /> {t('panels.windAtmosphere', 'WIND & ATMOSPHERE')}</h3>
                  <div className="wind-stats">
                    <div><PanelIcon name="map-pin" size={11} color="currentColor" /> {t('windAtmosphere.direction', 'Direction')}: {liveWeather?.current?.windDirection ?? '—'}</div>
                    <div><PanelIcon name="wind" size={11} color="currentColor" /> {t('windAtmosphere.speed', 'Speed')}: {typeof liveWeather?.current?.windSpeed === 'number' ? `${liveWeather.current.windSpeed} km/h` : t('cityList.noLiveData', 'NO LIVE DATA')}</div>
                    <div><PanelIcon name="wind" size={11} color="currentColor" /> {t('windAtmosphere.gust', 'Gust')}: {typeof liveWeather?.current?.windGust === 'number' ? `${liveWeather.current.windGust} km/h` : '—'}</div>
                    <div><PanelIcon name="gauge" size={11} color="currentColor" /> {t('windAtmosphere.pressure', 'Pressure')}: {typeof liveWeather?.current?.pressure === 'number' ? `${liveWeather.current.pressure} hPa` : '—'}</div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'AI + Export' && (
            <div className="dashboard-content">
              <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
                {/* PANEL N: AI Analyst — logic lives in shared AIAnalystPanel (also used by
                    the floating quick-access assistant) and calls the secure /api/ask-ai
                    backend proxy, so the Gemini API key never reaches the browser. */}
                <section className="panel">
                  <h3><PanelIcon name="bot" /> {t('panels.aiAnalyst', 'AGNI')}</h3>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: -8, marginBottom: 12 }}>
                    {t('panels.aiAnalystFullName', 'Analytical Ground-level heat iNtelligence Interface')}
                  </div>
                  <AIAnalystPanel
                    cityName={selectedCity}
                    stateName={selectedState}
                    ensoPhase={ensoPhase}
                    lst={realSurfaceTemp}
                    ndvi={realLulcEntry?.vegetation ?? null}
                    ndbi={realLulcEntry?.builtUp ?? null}
                    aqi={liveWeather?.aqi?.usAQI}
                    chatHistory={chatHistory}
                    setChatHistory={setChatHistory}
                    aiLoading={aiLoading}
                    setAiLoading={setAiLoading}
                    selectedQuestion={selectedQuestion}
                    setSelectedQuestion={setSelectedQuestion}
                    questionDropOpen={questionDropOpen}
                    setQuestionDropOpen={setQuestionDropOpen}
                  />
                </section>

                {/* PANEL M: Gamification */}
                <section className="panel">
                  <h3><PanelIcon name="star" /> {t('panels.gamification', 'POINTS & BADGES')}</h3>
                  <div className="points-display">⭐ {userName}: {points} pts</div>
                  <div className="badges-shelf">
                    {points >= 10 && <span className="badge">🏅 First Analysis</span>}
                    {treeSlider > 0.25 && <span className="badge">🌿 Tree Hugger</span>}
                    {analyzedCities.length >= 3 && <span className="badge">🏙️ City Explorer</span>}
                    {selectedQuestion > 0 && <span className="badge">🤖 AI Explorer</span>}
                  </div>
                </section>

                {/* PANEL Q: Glossary */}
                <section className="panel">
                  <h3><PanelIcon name="book-open" /> {t('panels.glossary', 'GLOSSARY')} {showGlossary && '✓'}</h3>
                  <button onClick={() => setShowGlossary(!showGlossary)} className="glossary-toggle">
                    {showGlossary ? `▼ ${t('buttons.hideGlossary', 'Hide Glossary')}` : `▶ ${t('buttons.showGlossary', 'Show Glossary')}`}
                  </button>
                  {showGlossary && (
                    <div className="glossary-grid">
                      {['LST', 'NDVI', 'NDBI', 'NDWI', 'UHI', 'ENSO', 'IOD', 'MJO'].map(key => (
                        <div key={key}>
                          <strong>{t(`glossary.${key}.term`, key)}:</strong> {t(`glossary.${key}.definition`, '')}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
                {/* PANEL P: Export & Share (kept — duplicate panel from the Analysis section removed) */}
                <section className="panel">
                  <h3><PanelIcon name="share" /> {t('panels.exportShare', 'EXPORT & SHARE')}</h3>
                  <div className="export-buttons">
                    <button onClick={() => {
                      const surfaceTemp = liveWeather?.current?.surfaceTemp
                      const lulcEntry = getLulcWithFallback(selectedCity, selectedState, lulcReal, cityCoordsData)
                      const vegText = lulcEntry
                        ? `${lulcEntry.vegetation}% (ESA WorldCover${lulcEntry.isFallback ? `, est. from ${lulcEntry.fallbackCity}` : ''})`
                        : 'N/A'
                      const { time, period } = formatClock(new Date())
                      const summary = `${selectedCity}, ${selectedState}: Surface Temp ${typeof surfaceTemp === 'number' ? surfaceTemp.toFixed(1) + '°C (live, Open-Meteo)' : 'N/A'} | Vegetation ${vegText} | AQI ${liveWeather?.aqi?.usAQI ?? 'N/A'} (live) | Time: ${time} ${period}`
                      navigator.clipboard.writeText(summary)
                      alert("Summary copied to clipboard!")
                    }}><PanelIcon name="copy" size={13} color="currentColor" /> {t('buttons.copySummary', 'Copy Summary')}</button>
                    <button onClick={() => {
                      const surfaceTemp = liveWeather?.current?.surfaceTemp
                      const liveRisk = liveIndiaData[selectedState]?.heatIndexLive ? getStateRiskLabel(liveIndiaData[selectedState]) : `${state.risk} (estimated)`
                      const msg = `Check out ${selectedCity} heat analysis on BhaskarOps! Surface Temp: ${typeof surfaceTemp === 'number' ? surfaceTemp.toFixed(1) + '°C (live)' : 'N/A'} | Risk: ${liveRisk}`
                      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`)
                    }}><PanelIcon name="message-circle" size={13} color="currentColor" /> {t('buttons.whatsappShare', 'WhatsApp Share')}</button>
                    <button onClick={() => {
                      const surfaceTemp = liveWeather?.current?.surfaceTemp
                      const lulcEntry = getLulcWithFallback(selectedCity, selectedState, lulcReal, cityCoordsData)
                      const vegCell = lulcEntry ? `${lulcEntry.vegetation}${lulcEntry.isFallback ? ` (est. from ${lulcEntry.fallbackCity})` : ''}` : 'N/A'
                      const builtCell = lulcEntry ? `${lulcEntry.builtUp}${lulcEntry.isFallback ? ` (est. from ${lulcEntry.fallbackCity})` : ''}` : 'N/A'
                      const liveRisk = liveIndiaData[selectedState]?.heatIndexLive ? getStateRiskLabel(liveIndiaData[selectedState]) : `${state.risk} (estimated)`
                      const csv = `City,State,SurfaceTempC_live,VegetationPct_WorldCover,BuiltUpPct_WorldCover,AQI_live,Risk\n${selectedCity},${selectedState},${typeof surfaceTemp === 'number' ? surfaceTemp.toFixed(1) : 'N/A'},${vegCell},${builtCell},${liveWeather?.aqi?.usAQI ?? 'N/A'},${liveRisk}`
                      const blob = new Blob([csv], {type:'text/csv'})
                      const url = window.URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${selectedCity}-analysis.csv`
                      a.click()
                    }}><PanelIcon name="download" size={13} color="currentColor" /> {t('buttons.csvDownload', 'CSV Download')}</button>
                    <button onClick={() => {
                      const lulcEntry = getLulcWithFallback(selectedCity, selectedState, lulcReal, cityCoordsData)
                      generatePDF(selectedCity, selectedState, {
                        surfaceTemp: liveWeather?.current?.surfaceTemp,
                        elevation: liveWeather?.current?.elevation,
                        aqi: liveWeather?.aqi?.usAQI,
                        humidity: liveWeather?.current?.humidity,
                        windSpeed: liveWeather?.current?.windSpeed,
                        vegetationPct: lulcEntry?.vegetation,
                        builtUpPct: lulcEntry?.builtUp,
                        waterPct: lulcEntry?.water,
                        lulcAvailable: !!lulcEntry,
                        mlR2: mlModelReal?.metrics?.r2 ?? mlModelReal?.r2,
                        mlMae: mlModelReal?.metrics?.mae ?? mlModelReal?.mae,
                        mlAlgorithm: mlModelReal?.model?.algorithm ?? mlModelReal?.algorithm
                      })
                    }}><PanelIcon name="file-text" size={13} color="currentColor" /> {t('buttons.pdfReport', 'PDF Report')}</button>
                  </div>
                </section>

                {/* PANEL O: Progress Tracker */}
                <section className="panel">
                  <h3><PanelIcon name="clipboard-list" /> {t('panels.progressTracker', 'BhaskarOps 2026 PROGRESS')}</h3>
                  <div className="progress-list">
                    <div><PanelIcon name="check-square" size={12} color="#22c55e" /> {t('progressTracker.dataCollection', 'Data Collection (Open-Meteo + ESA WorldCover)')}</div>
                    <div><PanelIcon name="check-square" size={12} color="#22c55e" /> {t('progressTracker.lstCalculation', 'Live Surface Temperature')}</div>
                    <div><PanelIcon name="check-square" size={12} color="#22c55e" /> {t('progressTracker.indexCalculation', 'Vegetation/Built-up Fractions (36 cities)')}</div>
                    <div><PanelIcon name="check-square" size={12} color="#22c55e" /> {t('progressTracker.correlationAnalysis', 'Correlation Analysis')}</div>
                    <div><PanelIcon name="check-square" size={12} color="#22c55e" /> {t('progressTracker.randomForestModel', 'Random Forest Model')}</div>
                    <div><PanelIcon name="check-square" size={12} color="#22c55e" /> {t('progressTracker.interventionSimulation', 'Intervention Simulation')}</div>
                    <div><PanelIcon name="check-square" size={12} color="#22c55e" /> {t('progressTracker.dashboardCreation', 'Dashboard Creation')}</div>
                    <div><PanelIcon name="square" size={12} color="#64748b" /> {t('progressTracker.reportSubmission', 'Report Submission')}</div>
                  </div>
                  <div className="progress-bar-main">
                    <div className="progress" style={{width: '87.5%'}}/>
                  </div>
                  <p className="progress-text">{t('progressTracker.stepsComplete', '{{done}}/{{total}} Steps Complete', { done: 7, total: 8 })}</p>
                </section>

                {/* PANEL R: About & Team */}
                <section className="panel">
                  <h3><PanelIcon name="users" /> {t('panels.aboutTeam', 'TEAM & METHODOLOGY')}</h3>
                  <div className="about-card">
                    <h4>BhaskarOps 2026: Urban Heat Island Mitigation</h4>
                    <p><strong>{t('aboutTeam.college', 'College:')}</strong> [Removed]</p>
                    <p><strong>{t('aboutTeam.method', 'Method:')}</strong> Open-Meteo (live) + ESA WorldCover + Random Forest ML</p>
                    <p><strong>{t('aboutTeam.focus', 'Focus:')}</strong> Delhi NCR & Indian Urban Heat Islands</p>
                    <p><strong>{t('aboutTeam.team', 'Team:')}</strong> Heatwave Mitigation Initiative</p>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
            </div>
          )
        })()}
      </>
    )
  }

  // Profile screen — "My Profile"/"My Badges" in the user menu used to set
  // screen to 'profile' with no matching branch here, so they silently fell
  // through to the catch-all "Loading..." with no way back. Built a minimal
  // real screen using data that already exists (points, badges, login history)
  // rather than fabricating stats, plus a working back button.
  if(screen === "profile") {
    const earnedBadges = [
      points >= 10 && { icon: '🏅', label: 'First Analysis', desc: 'Asked the AI Analyst a question' }
    ].filter(Boolean)

    return (
      <div className="dashboard-container">
        <nav className="navbar">
          <div className="nav-left">
            <button onClick={() => setScreen("map")} className="nav-btn">← {t('nav.backToMap', 'Back to Map')}</button>
            <h2>{t('profile.title', 'My Profile')}</h2>
          </div>
          <div className="nav-right">
            <AudienceToggle audience={audience} onChange={setAudience} size="md" />
            <ViewModeToggle mode={viewMode} onChange={setViewMode} size="md" />
            <button onClick={() => {setScreen("signin"); setUserName("")}} className="nav-btn">{t('nav.signOut', 'Sign Out')}</button>
          </div>
        </nav>

        <div style={{ padding: 24, maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section className="panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="avatar" style={{ width: 48, height: 48, fontSize: 20 }}>
                {userName[0]?.toUpperCase() || 'K'}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{userName || 'User'}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{userEmail || 'No email on file'}</div>
              </div>
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(148,163,184,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                View: <strong style={{ color: '#e2e8f0' }}>{citizen ? '🧑‍🤝‍🧑 Citizen' : '🏛️ Authority'}</strong> ⚙️
                <div style={{ fontSize: 11, marginTop: 2 }}>{citizen ? 'Simple essentials — temperature, risk level, what to do.' : 'Full technical dashboard — every tab, model and calculator.'}</div>
              </div>
              <button type="button" onClick={() => setAudience(citizen ? 'authority' : 'citizen')} className="nav-btn" style={{ fontSize: 12 }}>
                Switch to {citizen ? 'Authority' : 'Citizen'} view
              </button>
            </div>
          </section>

          <section className="panel">
            <h3><PanelIcon name="star" /> {t('panels.gamification', 'POINTS & BADGES')}</h3>
            <div className="points-display">⭐ {userName}: {points} pts</div>
            <div className="badges-shelf" style={{ marginTop: 8 }}>
              {earnedBadges.length === 0 ? (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  No badges earned yet — ask the AI Analyst a question to get started.
                </div>
              ) : earnedBadges.map(b => (
                <div key={b.label} className="badge" title={b.desc} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {b.icon} {b.label}
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <h3><PanelIcon name="clock" /> {t('panels.recentSignIns', 'Recent Sign-ins')}</h3>
            {loginHistory.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {loginHistory.map((entry, idx) => (
                  <div key={idx} style={{
                    display: 'flex', justifyContent: 'space-between', fontSize: 11,
                    padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6
                  }}>
                    <span style={{ color: '#cbd5e1' }}>{entry.name}</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>{new Date(entry.timestamp).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>
                {t('signIn.noRecentSignIns', 'No recent sign-ins yet. Your session will be logged after launch.')}
              </div>
            )}
          </section>
        </div>
      </div>
    )
  }

  // Admin Analytics Dashboard (SECTION 11)
  if(screen === "admin") {
    const analytics = getAnalyticsData()
    const cityCountData = Object.entries(analytics.cityCount || {})
      .map(([city, count]) => ({ name: city, value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
    
    const hourlyData = (analytics.hourlyLogins || []).map((count, hour) => ({
      hour: `${hour}:00`,
      logins: count
    }))
    
    const dailyData = Object.entries(analytics.dailyLogins || {})
      .map(([day, {success, failed}]) => ({
        date: day,
        success,
        failed,
        total: success + failed
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-30)

    return (
      <div className="admin-container" style={{
        width: '100vw',
        minHeight: '100vh',
        background: '#030b1a',
        color: '#fff',
        padding: '16px',
        boxSizing: 'border-box'
      }}>
        {/* Admin Header */}
        <nav style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          borderBottom: '1px solid #1a2a4a',
          marginBottom: '20px',
          borderRadius: '8px',
          background: 'rgba(0,0,0,0.3)'
        }}>
          <h1 style={{ fontSize: 20, color: '#d97706', margin: 0 }}>
            🛡️ Admin Analytics Dashboard
          </h1>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => { setScreen("signin"); setUserName("") }} style={{
              background: 'rgba(185,28,28,0.12)',
              border: '1px solid rgba(185,28,28,0.5)',
              color: '#dc2626',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px'
            }}>
              Sign Out
            </button>
          </div>
        </nav>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            background: 'rgba(148,163,184,0.06)',
            border: '1px solid rgba(148,163,184,0.2)',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              {t('admin.totalUsers', 'Total Users')}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f8fafc' }}>
              {analytics.users?.length || 0}
            </div>
          </div>

          <div style={{
            background: 'rgba(148,163,184,0.06)',
            border: '1px solid rgba(148,163,184,0.2)',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              {t('admin.totalLoginEvents', 'Total Login Events')}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f8fafc' }}>
              {analytics.history?.length || 0}
            </div>
          </div>

          <div style={{
            background: 'rgba(148,163,184,0.06)',
            border: '1px solid rgba(148,163,184,0.2)',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              {t('admin.citiesAnalyzed', 'Cities Analyzed')}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f8fafc' }}>
              {Object.keys(analytics.cityCount || {}).length}
            </div>
          </div>

          <div style={{
            background: 'rgba(148,163,184,0.06)',
            border: '1px solid rgba(148,163,184,0.2)',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              {t('admin.successRate', 'Success Rate')}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>
              {((analytics.history?.filter(h => h.status === 'success').length || 0) / (analytics.history?.length || 1) * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Charts */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          {/* Hourly Logins Chart */}
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid #1a2a4a',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#d97706' }}>{t('admin.hourlyLoginPattern', '📊 Hourly Login Pattern')}</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3,3" stroke="#1a2a4a" />
                <XAxis dataKey="hour" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ background: '#0a0e1a', border: '1px solid #1a2a4a' }} />
                <Line type="monotone" dataKey="logins" stroke="#d97706" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Daily Logins Chart */}
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid #1a2a4a',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#d97706' }}>{t('admin.dailyLoginTrend', '📈 Daily Login Trend (30 days)')}</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3,3" stroke="#1a2a4a" />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ background: '#0a0e1a', border: '1px solid #1a2a4a' }} />
                <Bar dataKey="success" stackId="a" fill="#15803d" />
                <Bar dataKey="failed" stackId="a" fill="#b91c1c" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Cities Analyzed */}
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid #1a2a4a',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#d97706' }}>{t('admin.topCitiesAnalyzed', '🏙️ Top 10 Cities Analyzed')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart layout="vertical" data={cityCountData}>
              <CartesianGrid strokeDasharray="3,3" stroke="#1a2a4a" />
              <XAxis type="number" stroke="#64748b" />
              <YAxis dataKey="name" type="category" stroke="#64748b" width={100} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0a0e1a', border: '1px solid #1a2a4a' }} />
              <Bar dataKey="value" fill="#d97706" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Login History */}
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid #1a2a4a',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#d97706' }}>{t('admin.recentLoginActivity', '📝 Recent Login Activity')}</h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px'
            }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a2a4a' }}>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#94a3b8' }}>{t('admin.tableUser', 'User')}</th>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#94a3b8' }}>{t('admin.tableEmail', 'Email')}</th>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#94a3b8' }}>{t('admin.tableTime', 'Time')}</th>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#94a3b8' }}>{t('admin.tableStatus', 'Status')}</th>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#94a3b8' }}>{t('admin.tableDuration', 'Duration')}</th>
                </tr>
              </thead>
              <tbody>
                {(analytics.history || []).slice(-10).reverse().map((entry, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(26,42,74,0.5)' }}>
                    <td style={{ padding: '8px', color: '#fff' }}>{entry.userName || '—'}</td>
                    <td style={{ padding: '8px', color: 'rgba(255,255,255,0.6)' }}>{entry.email || '—'}</td>
                    <td style={{ padding: '8px', color: 'rgba(255,255,255,0.6)' }}>
                      {new Date(entry.loginTime).toLocaleString('en-IN')}
                    </td>
                    <td style={{
                      padding: '8px',
                      color: entry.status === 'success' ? '#22c55e' : '#dc2626'
                    }}>
                      {entry.status === 'success' ? '✓ Success' : '✗ Failed'}
                    </td>
                    <td style={{ padding: '8px', color: 'rgba(255,255,255,0.6)' }}>
                      {entry.duration || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return <div>Loading...</div>
}

export default App
