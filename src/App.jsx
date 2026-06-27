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
import './App.css'
import { getCityData } from './utils/realData'
import { getBuildingDensity } from './utils/osmUtils'
import { SourceBadge } from './components/DataBadges'
import { MLModelPanel } from './components/MLModelPanel'
import { LandCoverPanel } from './components/LandCoverPanel'
import { PhysicsPanel } from './components/PhysicsPanel'
import { GEEPipelinePanel } from './components/GEEPipelinePanel'
import { SpatialRecommendation } from './components/SpatialRecommendation'
import { normalizeStateName, getCellTemp, getHistoricalData, getDayNightData, getHeatwaveEvents, getYoYComparison, getUsers, getLoginHistory, saveLoginHistory, getAnalyticsData, getTimeSpent } from './utils/dashboardUtils'
import { WeatherCard } from './components/WeatherCard'
import { getAQICategory } from './utils/weatherAPI'
import { useWeather } from './hooks/useWeather'
import { loadCityCoordinates } from './utils/cityCoordinateResolver'
import { getLulcWithFallback } from './utils/lulcFallback'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, changeLanguage } from './i18n'
import { AIAnalystPanel } from './components/AIAnalystPanel'
import { FloatingAIAssistant } from './components/FloatingAIAssistant'
import { CompareCitiesPanel } from './components/CompareCitiesPanel'

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
  cities:["Lucknow","Kanpur","Agra","Varanasi","Prayagraj","Meerut","Ghaziabad","Noida","Mathura","Moradabad","Bareilly","Aligarh","Gorakhpur","Saharanpur","Firozabad","Muzaffarnagar","Jhansi","Rampur","Shahjahanpur","Hapur","Unnao","Bahraich","Hardoi","Ballia","Sitapur","Faizabad","Sultanpur","Gonda","Etawah","Budaun","Azamgarh","Jaunpur","Mirzapur","Bijnor","Amroha","Bulandshahr","Etah","Mainpuri","Farrukhabad","Banda","Fatehpur","Raebareli","Pratapgarh","Ghazipur","Deoria","Basti","Ambedkar Nagar","Barabanki","Rae Bareli","Amethi","Chitrakoot","Hamirpur","Lalitpur","Mahoba","Lakhimpur Kheri","Pilibhit","Chandauli","Sant Kabir Nagar","Maharajganj","Kushinagar","Siddharth Nagar","Shravasti","Balrampur","Kanpur Dehat","Kanpur Nagar","Auraiya","Kannauj","Kasganj","Sambhal","Hathras","Baghpat","Shamli","Gautam Buddha Nagar","Orai","Jalaun","Kaushambi","Allahabad","Siddharthnagar","Mau","Sant Ravidas Nagar","Sonbhadra"]
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
    EXTREME: '#b81010',
    HIGH: '#bb5200',
    MODERATE: '#ffcc00',
    COOL: '#0a6638'
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
    EXTREME: {bg:'#ff2222', text:'#fff'},
    HIGH: {bg:'#ff6b35', text:'#fff'},
    MODERATE: {bg:'#ffcc00', text:'#222'},
    COOL: {bg:'#00cc66', text:'#fff'}
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
    EXTREME: "#ff2222",
    HIGH: "#ff6b35",
    MODERATE: "#ffcc00",
    COOL: "#00cc66"
  }
  return m[risk] || "#444"
}

function getAQIColor(aqi) {
  if (aqi > 300) return "#ff2222"
  if (aqi > 200) return "#ff6b35"
  if (aqi > 100) return "#ffcc00"
  return "#00ff88"
}

function getRiskText(risk) {
  return risk === 'MODERATE' ? '#222' : '#fff'
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
                color: lang.code === current.code ? '#00ff88' : '#e2e8f0',
                background: lang.code === current.code ? 'rgba(0,255,136,0.08)' : 'transparent',
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

function CityPanel({ stateName, stateData, onCitySelect, selectedCity, onAnalyze, liveCache, liveSelectedTemp, cacheLastUpdated, formatAgo, isCacheStale }) {
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
        color: "#00ff88",
        fontWeight: 700,
        borderLeft: "3px solid #00ff88",
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

      {cacheLastUpdated && (
        isCacheStale(cacheLastUpdated) ? (
          <div style={{ fontSize: 9, color: "#ffb020", marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            🟠 {t('panels.dataOutdated', 'Data may be outdated')} · last refresh {formatAgo(cacheLastUpdated)}
          </div>
        ) : (
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>
            📡 Live temps · updated {formatAgo(cacheLastUpdated)} · "~" = no live data for that city yet
          </div>
        )
      )}

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
            e.target.style.borderColor = "#00ff88"
            e.target.style.boxShadow =
              "0 0 12px rgba(0,255,136,0.2)"
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
        scrollbarColor: "#00ff88 #0a0e1a"
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

            const seed = city.split('')
              .reduce((a,c)=>a+c.charCodeAt(0),0)%100
            const estimatedLst = (
              (stateData.avgLST || 38) +
              (seed/100)*4 - 2
            )
            const lst = (isLive ? liveTemp : estimatedLst).toFixed(1)

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
                    ? "rgba(0,255,136,0.12)"
                    : "transparent",
                  borderBottom: idx < filtered.length-1
                    ? "1px solid rgba(255,255,255,0.05)"
                    : "none",
                  transition: "background 0.15s",
                  borderLeft: isSelected
                    ? "3px solid #00ff88"
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
                      ? "#00ff88" : "#ffffff"
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
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: getThemeAccent(parseFloat(lst)),
                    transition: 'color 0.4s ease'
                  }}>
                    {isLive ? '' : '~'}{lst}°C
                  </span>
                  {isSelected && (
                    <span style={{
                      fontSize: 9,
                      background: "#00ff88",
                      color: "#000",
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
            background: "linear-gradient(135deg, #00ff88, #00d4ff)",
            border: "none",
            borderRadius: 10,
            color: "#000",
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
          {t('tooltips.clickCityToAnalyze', '👆 Click any city above to analyze')}
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
const INDIA_MAP_PROJECTION_CONFIG = { scale: 1000, center: [82.8, 22.5] }

// STATES_URL (~23MB) and JK_URL are each used by TWO separate map layers
// (fill + border). Without this cache, react-simple-maps' <Geographies> fetches
// and JSON-parses the same large file twice per layer pair, which was a real
// contributor to the slow/"stuck" map load. One shared in-flight-promise cache
// per URL means every layer reuses the same fetch+parse instead of redoing it.
const geoDataCache = new Map()
function useGeoData(url) {
  const [data, setData] = useState(null)
  useEffect(() => {
    let cached = geoDataCache.get(url)
    if (!cached) {
      cached = fetch(url).then(r => r.json())
      geoDataCache.set(url, cached)
    }
    let active = true
    cached.then(json => { if (active) setData(json) })
    return () => { active = false }
  }, [url])
  return data
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

function smoothGeoFeature(feature) {
  if (!feature || !feature.geometry) return feature
  return { ...feature, geometry: smoothGeometry(feature.geometry) }
}

// Single source of truth for heat-index color/risk buckets — used by getHeatIndexColor,
// getRiskLabel, and the map legend, so they can never drift out of sync with each other.
const HEAT_INDEX_BUCKETS = [
  { min: 45, color: '#cc0000', label: 'EXTREME', legend: 'EXTREME 45+' },
  { min: 40, color: '#e63c00', label: 'VERY HIGH', legend: 'VERY HIGH 40-45' },
  { min: 35, color: '#cc6600', label: 'HIGH', legend: 'HIGH 35-40' },
  { min: 30, color: '#aa8800', label: 'MODERATE', legend: 'MODERATE 30-35' },
  { min: 25, color: '#667700', label: 'LOW-MODERATE', legend: 'LOW-MODERATE 25-30' },
  { min: -Infinity, color: '#1a6622', label: 'LOW', legend: 'LOW <25' }
]

function getHeatIndexColor(heatIndex) {
  return HEAT_INDEX_BUCKETS.find(b => heatIndex >= b.min).color
}

function getRiskLabel(heatIndex) {
  return HEAT_INDEX_BUCKETS.find(b => heatIndex >= b.min).label
}

// UI "thermal" accent theme — 3 broad interface categories that drive card borders,
// glows, headings and button accents via CSS custom properties. Completely separate
// from HEAT_INDEX_BUCKETS above: the map's 6-bucket legend/fill colors are fixed
// data-meaning and must never change with this. This is a visual theme layer only.
const UI_THEME_BUCKETS = [
  { min: 40, accent: '#ff5c3c', bgStart: '#2a0a08', bgEnd: '#1a0605', glow: 'rgba(255,70,40,0.4)' },
  { min: 30, accent: '#ffa83c', bgStart: '#2a1c08', bgEnd: '#1a1205', glow: 'rgba(255,170,40,0.3)' },
  { min: -Infinity, accent: '#3ca8ff', bgStart: '#081c2a', bgEnd: '#05111a', glow: 'rgba(60,160,255,0.4)' }
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
    return { category, groupKey: 'HOT', color: category === 'EXTREME' ? '#ff2222' : '#ff6b35', items }
  }

  if (temp < 15) {
    return {
      category: 'COLD',
      groupKey: 'COLD',
      color: '#00a8ff',
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
    color: '#00ff88',
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

const EXTREME_HEAT_HOTSPOTS = [
  { name: 'Delhi', coords: [77.1, 28.6] },
  { name: 'Rajasthan', coords: [74.0, 26.5] },
  { name: 'Uttar Pradesh', coords: [80.9, 26.8] },
  { name: 'Gujarat', coords: [71.5, 22.5] },
  { name: 'Bihar', coords: [85.3, 25.5] }
]

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
      projection='geoMercator'
      projectionConfig={INDIA_MAP_PROJECTION_CONFIG}
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
            const color = getHeatIndexColor(heat)
            if (!color || typeof color !== 'string') {
              console.warn('INVALID HEAT COLOR', heat, stateName)
            }
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
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

// LAYER 2 extracted + memoized, same reasoning as DistrictsLayer above. The `isHov` check
// previously read from app-level hoveredState was redundant: react-simple-maps' Geography
// only applies its `hover:` style to the specific element actually under the cursor (its
// own internal per-element hover state), so by the time this element's hover style is
// showing, hoveredState===name is already guaranteed true. Dropping that redundant read
// removes the need for this layer to depend on hoveredState at all — onHoverEnter/Leave
// are stable callbacks (useCallback, empty deps) so this never re-renders on hover.
const StatesInteractiveLayer = React.memo(function StatesInteractiveLayer({ DATA, onStateClick, onHoverEnter, onHoverLeave }) {
  return (
    <ComposableMap
      projection='geoMercator'
      projectionConfig={INDIA_MAP_PROJECTION_CONFIG}
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
            const color = getHeatIndexColor(heat)
            const baseFill = 'rgba(0,0,0,0)'
            return (
              <Geography
                key={geo.rsmKey + '_state'}
                geography={geo}
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
      projection='geoMercator'
      projectionConfig={INDIA_MAP_PROJECTION_CONFIG}
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

              const color = getHeatIndexColor(DATA?.[stateName]?.heatIndex || 30)
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
                      stroke: '#00d4ff',
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
      projection='geoMercator'
      projectionConfig={INDIA_MAP_PROJECTION_CONFIG}
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
      projection='geoMercator'
      projectionConfig={INDIA_MAP_PROJECTION_CONFIG}
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
const IndiaMap = React.forwardRef(({ INDIA_DATA: propINDIA_DATA, onStateClick, scale = 1, pos = { x: 0, y: 0 }, isDragging = false }, transformRef) => {
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
        el.style.stroke = '#00d4ff'
        el.style.strokeWidth = '2.8'
      }
    }
    prevHoveredBorderRef.current = hoveredState
  }, [hoveredState])

  // DISTRICTS_URL/STATES_URL are large (~35MB/~23MB) geojson files — fetch +
  // parse genuinely takes several seconds. Without this, the map area looks
  // blank/stuck during that window instead of visibly loading.
  const districtsReady = !!useGeoData(DISTRICTS_URL)
  const statesReady = !!useGeoData(STATES_URL)
  const mapDataLoading = !districtsReady || !statesReady

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
        {mapDataLoading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 30,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, background: 'rgba(10,14,26,0.85)'
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '3px solid rgba(0,212,255,0.25)', borderTopColor: '#00d4ff',
              animation: 'spin 0.9s linear infinite'
            }} />
            <div style={{ color: '#94a3b8', fontSize: 12 }}>
              Loading map data…
            </div>
          </div>
        )}
        {/* LAYER 1: District texture colored by parent-state heat — extracted + memoized
            above (DistrictsLayer) so hover-state changes elsewhere on the map don't force
            this large GeoJSON layer to recompute its projection on every hover. */}
        <DistrictsLayer DATA={DATA} />

      {/* LAYER 2 + 2.5: extracted + memoized above (StatesInteractiveLayer/JKInteractiveLayer)
          — click/hover detection no longer forces a recompute of these GeoJSON layers on
          every hover; only the small tooltip panel and border-highlight layers update. */}
      <StatesInteractiveLayer DATA={DATA} onStateClick={onStateClick} onHoverEnter={handleHoverEnter} onHoverLeave={handleHoverLeave} />
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

      {/* LAYER 4: Pulsing extreme-heat hotspot markers.
          Previously red/#ff3333 — same color family as the EXTREME/VERY HIGH
          heat zones underneath them, so they nearly disappeared into the map.
          White-with-dark-outline guarantees contrast against red, orange, AND
          yellow heat zones alike (not just the specific shade behind any one
          marker), per the suggested fix. */}
      <ComposableMap
        projection='geoMercator'
        projectionConfig={INDIA_MAP_PROJECTION_CONFIG}
        style={{ ...INDIA_MAP_LAYER_STYLE, pointerEvents: 'none' }}
      >
        {EXTREME_HEAT_HOTSPOTS.map((spot) => (
          <Marker key={spot.name} coordinates={spot.coords}>
            <circle r={6} fill='none' stroke='#ffffff' strokeWidth={1.5} opacity={0.95}>
              <animate attributeName='r' values='5;10;5' dur='1.6s' repeatCount='indefinite' />
              <animate attributeName='opacity' values='0.95;0.4;0.95' dur='1.6s' repeatCount='indefinite' />
            </circle>
            <circle r={3.5} fill='#ffffff' stroke='#0a0e1a' strokeWidth={1.5} />
          </Marker>
        ))}
      </ComposableMap>

      {/* LAYER 5: Active-state glowing cyan crosshair marker */}
      {activeName && activeData?.centroid && (
        <ComposableMap
          projection='geoMercator'
          projectionConfig={INDIA_MAP_PROJECTION_CONFIG}
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

      {/* LAYER 6: Island labels */}
      <ComposableMap
        projection='geoMercator'
        projectionConfig={INDIA_MAP_PROJECTION_CONFIG}
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
            border: '1px solid rgba(0, 212, 255, 0.4)',
            borderRadius: 10,
            padding: '12px 14px',
            color: '#e2e8f0',
            fontFamily: 'monospace',
            fontSize: 12,
            boxShadow: '0 0 20px rgba(0,212,255,0.15)',
            pointerEvents: 'none',
            zIndex: 20
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{tooltip.name}</div>
          <div style={{ marginBottom: 4 }}>🌡️ Heat Index: <strong>{activeData.heatIndex}°C</strong></div>
          <div style={{ marginBottom: 4 }}>
            Risk:{' '}
            <span style={{ background: getHeatIndexColor(activeData.heatIndex), padding: '1px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
              {getRiskLabel(activeData.heatIndex)}
            </span>
          </div>
          <div style={{ marginBottom: 4 }}>📍 Cities: <strong>{activeData.cities?.length || 0}</strong></div>
          <div style={{ color: '#00d4ff', fontSize: 11, marginTop: 6 }}>Click to explore cities →</div>
        </div>
      )}

      {/* HEAT INDEX LEGEND — bottom-left */}
      <div
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
          zIndex: 20
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6, letterSpacing: 0.5 }}>HEAT INDEX</div>
        {HEAT_INDEX_BUCKETS.map(b => (
          <LegendRow key={b.label} color={b.color} label={b.legend} />
        ))}
        {dataAgeLabel && (
          <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 10, color: '#64748b' }}>
            {dataAgeLabel}
          </div>
        )}
      </div>
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
// block right after the map appears — the districts layer alone has 594 features in a
// 34.5MB file, and the states layer's 35 features average ~650KB of coordinate data each.
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
// (594 features / 34.5MB), but the states file has very few, individually huge ones (35
// features / 23MB, ~650KB of coordinates each) — a chunk size tuned for districts would
// still make each states chunk freeze for a long stretch. Smaller chunks were tried as a
// flat default (3) and made total time-to-fully-rendered WORSE, not better, since each
// chunk forces a full React re-render/commit and that fixed per-chunk overhead dominates at
// small sizes far more than the geometry math does — so districts gets a larger chunk to
// amortize that overhead, while states/J&K get a much smaller one to keep each individual
// chunk's heavier per-feature cost from blocking input for too long at once.
const GEO_CHUNK_SIZE_BY_URL = { [STATES_URL]: 2, [JK_URL]: 2, [DISTRICTS_URL]: 40 }
const GEO_CHUNK_SIZE_DEFAULT = 20
function GeographiesLayer({ url, render }) {
  const data = useGeoData(url)
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

const UserAvatarMenu = ({ currentUser, isAdmin, setScreen, onLogout }) => {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          cursor: 'pointer',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${isAdmin ? 'rgba(255,215,0,0.3)' : 'rgba(0,212,255,0.2)'}`,
          borderRadius: 6, padding: '3px 8px', fontSize: 11
        }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: 3,
          background: isAdmin ? 'rgba(255,215,0,0.2)' : 'rgba(0,212,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: isAdmin ? '#fbbf24' : '#00d4ff'
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
                fontSize: 9, marginTop: 4, background: isAdmin ? 'rgba(255,215,0,0.15)' : 'rgba(0,212,255,0.15)',
                color: isAdmin ? '#fbbf24' : '#00d4ff', borderRadius: 4, padding: '2px 6px',
                width: 'fit-content'
              }}>
                {isAdmin ? 'ADMIN' : 'USER'}
              </div>
            </div>
            {[
              { icon: '👤', label: 'My Profile', fn: () => { setScreen?.('profile'); setOpen(false) } },
              { icon: '🏆', label: 'My Badges', fn: () => { setScreen?.('profile'); setOpen(false) } },
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

const TickerBar = ({ leaderBase, liveAqiAlert, liveStormWatch, liveMumbai, liveShimla }) => {
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

  return (
    <div style={{
      display: 'flex', alignItems: 'center', height: 28,
      background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)',
      padding: '0 16px', gap: 12, overflow: 'hidden'
    }}>
      {/* LIVE badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700,
        color: '#ff4444', flexShrink: 0
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: '#ff4444',
          animation: 'navPulse 1s ease-in-out infinite'
        }} />
        LIVE
      </div>

      {/* Scrolling ticker */}
      <div style={{
        flex: 1, display: 'flex', gap: 20, overflow: 'hidden', position: 'relative'
      }}>
        <div style={{
          display: 'flex', gap: 20,
          animation: 'navTicker 40s linear infinite'
        }}>
          {[...items, ...items].map((item, i) => (
            <div key={i} style={{
              display: 'flex', gap: 6, alignItems: 'center',
              fontSize: 10, color: '#cbd5e1', whiteSpace: 'nowrap', flexShrink: 0
            }}>
              <span>{item.icon}</span>
              <span style={{ fontWeight: 600 }}>{item.label}:</span>
              <span style={{ color: '#94a3b8' }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SAT ACTIVE badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700,
        color: '#00d4ff', flexShrink: 0, paddingLeft: 12, borderLeft: '1px solid rgba(255,255,255,0.1)'
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
      textAlign: 'right', color: '#cbd5e1'
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

const CompactNavbar = ({ currentUser, setScreen, scrollToMap, onLogout, leaderBase, liveAqiAlert, liveStormWatch, liveMumbai, liveShimla, darkMode, setDarkMode }) => {
  const { t, i18n } = useTranslation()
  const isAdmin = currentUser?.role === 'admin'

  return (
    <>
      {/* Main navbar row — 52px */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 52,
        background: 'linear-gradient(90deg, rgba(4,11,26,0.98), rgba(9,18,40,0.95))',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '0 16px', gap: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        {/* Logo & title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 20 }}>🛰️</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: '#00ff88' }}>HEATOPS</div>
            <div style={{ fontSize: 8, letterSpacing: '0.12em', color: '#64748b' }}>THERMAL</div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />

        {/* Status pills — all inline */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {[
            { icon: '🔴', label: 'HEAT', value: 'HIGH', color: '#ff4444' },
            { icon: '🟡', label: 'CLIMATE', value: 'EL NIÑO', color: '#fbbf24' },
            { icon: '🟢', label: 'SYSTEM', value: 'OPS', color: '#00ff88' }
          ].map(pill => (
            <div
              key={pill.label}
              style={{
                display: 'flex', flexDirection: 'column', gap: 1,
                fontSize: 8, fontWeight: 700, color: pill.color,
                background: `rgba(${pill.color === '#ff4444' ? '255,68,68' : pill.color === '#fbbf24' ? '251,191,36' : '0,255,136'},0.1)`,
                border: `1px solid rgba(${pill.color === '#ff4444' ? '255,68,68' : pill.color === '#fbbf24' ? '251,191,36' : '0,255,136'},0.25)`,
                borderRadius: 4, padding: '4px 8px', minWidth: 48, textAlign: 'center'
              }}
            >
              <span style={{ letterSpacing: '0.08em' }}>{pill.label}</span>
              <span>{pill.value}</span>
            </div>
          ))}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Right section */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <LiveClock />

          {/* Language toggle — manual only, no auto-detect by location/browser */}
          <LanguageDropdown />

          {/* Dark/light theme toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              background: 'rgba(255,255,255,0.05)', color: '#cbd5e1',
              border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4,
              fontSize: 13, padding: '4px 8px', cursor: 'pointer', outline: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>

          {/* Divider */}
          <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />

          {/* Agent badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 9,
            color: '#00ff88'
          }}>
            <span>🤖</span>
            <div>
              <div style={{ fontWeight: 700, letterSpacing: '0.08em' }}>AGENT</div>
              <div style={{ fontSize: 8, color: '#00ff88', letterSpacing: '0.08em' }}>ONLINE</div>
            </div>
          </div>

          {/* User avatar menu */}
          <UserAvatarMenu
            currentUser={currentUser}
            isAdmin={isAdmin}
            setScreen={setScreen}
            onLogout={() => { setScreen('signin'); onLogout?.() }}
          />

          {/* Logout button */}
          <button
            onClick={() => { setScreen('signin') }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,80,80,0.2)'
              e.currentTarget.style.color = '#ff4444'
              e.currentTarget.style.borderColor = 'rgba(255,80,80,0.6)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,80,80,0.08)'
              e.currentTarget.style.color = '#ff6666'
              e.currentTarget.style.borderColor = 'rgba(255,80,80,0.3)'
            }}
            style={{
              padding: '6px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              background: 'rgba(255,80,80,0.08)', color: '#ff6666',
              border: '1px solid rgba(255,80,80,0.3)', borderRadius: 4,
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            {t('nav.signOut', 'LOGOUT')}
          </button>
        </div>
      </div>

      {/* Ticker bar — 28px */}
      <TickerBar
        leaderBase={leaderBase}
        liveAqiAlert={liveAqiAlert}
        liveStormWatch={liveStormWatch}
        liveMumbai={liveMumbai}
        liveShimla={liveShimla}
      />
    </>
  )
}

function App({ user }) {
  const { t, i18n } = useTranslation()

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
  
  // Theme & UI
  // darkMode previously only flipped the button icon — nothing ever read the
  // state, so the toggle looked broken. This now applies/removes a `light-mode`
  // class on <body> (see index.css / App.css `body.light-mode` rules) and
  // persists the choice so it survives refresh.
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const saved = window.localStorage.getItem('heatops_dark_mode')
      return saved === null ? true : saved === 'true'
    } catch {
      return true
    }
  })

  useEffect(() => {
    document.body.classList.toggle('light-mode', !darkMode)
    try { window.localStorage.setItem('heatops_dark_mode', String(darkMode)) } catch {}
  }, [darkMode])

  // Map & Selection
  const [selectedState, setSelectedState] = useState(null)
  const [selectedCity, setSelectedCity] = useState(null)
  // Stable reference (useCallback) so IndiaMap's memoized interactive layers don't see a
  // "new" onStateClick prop — and re-render their full GeoJSON — every time App re-renders
  // for an unrelated reason (e.g. live weather polling) while the map screen is showing.
  const handleStateClick = useCallback((name) => {
    const fixed = fixStateName(name)
    if (fixed !== selectedState) {
      setSelectedState(fixed)
      const defaultCity = (INDIA_DATA[fixed] && Array.isArray(INDIA_DATA[fixed].cities) && INDIA_DATA[fixed].cities.length > 0)
        ? INDIA_DATA[fixed].cities[0]
        : null
      setSelectedCity(defaultCity)
    }
  }, [selectedState])
  const [activeTab, setActiveTab] = useState('Overview')
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

  // Live weather cache for the MAP screen — same live-data pipeline as above, but pre-fetched
  // in bulk for all ~1,700 geocoded cities (via scripts/refreshWeatherCache.mjs, refreshed every
  // ~20 min on the server) rather than fetched per-click. Powers the City List, Hottest Cities
  // panel, Navbar ticker, and State Panel AQI. The currently selected city still gets the
  // extra direct fetch above (liveWeather) for maximal freshness, layered on top of this cache.
  const [liveCityCache, setLiveCityCache] = useState({})
  const [cacheLastUpdated, setCacheLastUpdated] = useState(null)

  useEffect(() => {
    // Defer fetch to avoid blocking UI on sign-in. Delay 500ms to let the
    // map interactive before heavy JSON parsing starts.
    const timer = setTimeout(() => {
      fetch('/live-weather-cache.json')
        .then(r => r.json())
        .then(data => {
          setLiveCityCache(data.cities || {})
          setCacheLastUpdated(data.lastUpdated || null)
        })
        .catch(() => {})
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  // Real RandomForestRegressor metrics (R², MAE, feature_importances_) trained
  // on real MODIS satellite data — see scripts/train_lst_model.py. One global
  // model, not per-city, so this is fetched once and passed to MLModelPanel
  // regardless of which city is selected.
  const [mlModelReal, setMlModelReal] = useState(null)
  useEffect(() => {
    // Defer fetch to avoid blocking UI on sign-in. Delay 1s to let the
    // map interactive before heavy JSON parsing starts.
    const timer = setTimeout(() => {
      fetch('/data/ml_model_real.json')
        .then(r => r.json())
        .then(setMlModelReal)
        .catch(() => {})
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  // Real ESA WorldCover land-cover classification — only computed for one
  // representative city per state (see scripts/build_lulc_data.py). Cities not
  // in this file fall back to the nearest real entry (getLulcWithFallback) rather
  // than showing nothing — see src/utils/lulcFallback.js.
  const [lulcReal, setLulcReal] = useState(null)
  useEffect(() => {
    // Defer fetch to avoid blocking UI on sign-in. Delay 1.5s to let the
    // map interactive before heavy JSON parsing starts.
    const timer = setTimeout(() => {
      fetch('/data/lulc_real.json')
        .then(r => r.json())
        .then(setLulcReal)
        .catch(() => {})
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  // Precise per-city coordinates (1,689/1,956 cities) — used both by the live weather
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

  const liveLeaderBase = useMemo(() => {
    const all = Object.values(liveCityCache).filter(c => typeof c.temp === 'number')
    if (all.length === 0) return leaderBase // seed list shown only until the cache first loads
    return [...all]
      .sort((a, b) => b.temp - a.temp)
      .slice(0, 5)
      .map((c, i) => ({ city: c.city, state: c.state, temp: c.temp, flag: i < 4 ? '🔴' : '🟠' }))
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

  const extremeOrHighRiskStateCount = useMemo(
    () => Object.values(STATE_DATA).filter(s => s.risk === 'EXTREME' || s.risk === 'HIGH').length,
    []
  )

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
    return `${Math.round(mins / 60)}h ago`
  }

  // The bulk weather cache (live-weather-cache.json) is meant to refresh at least every few
  // hours — if the refresh job behind it ever stalls (cron misconfigured, daemon not running,
  // a fresh pull never committed), this catches it and tells the user honestly instead of
  // quietly showing a days-old number as if it were current.
  const isCacheStale = (iso) => !!iso && (Date.now() - new Date(iso).getTime()) > 24 * 60 * 60 * 1000

  // Sliders (Interventions)
  const [treeSlider, setTreeSlider] = useState(0)
  const [roofSlider, setRoofSlider] = useState(0)
  const [waterSlider, setWaterSlider] = useState(0)
  
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
        ctx.strokeStyle = 'rgba(0,212,255,0.35)'
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
        ctx.strokeStyle = `rgba(0,212,255,${Math.cos(angle) > 0 ? 0.4 : 0.15})`
        ctx.lineWidth = 0.8
        ctx.stroke()
      }

      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0,212,255,0.5)'
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
      ctx.fillStyle = '#00d4ff'
      ctx.fillRect(-8, -3, 16, 6)
      ctx.fillStyle = '#00ff88'
      ctx.fillRect(-22, -2, 12, 4)
      ctx.fillRect(10, -2, 12, 4)
      ctx.restore()

      ctx.beginPath()
      ctx.setLineDash([4, 8])
      ctx.ellipse(cx, cy, orbitA, orbitB, 0, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0,212,255,0.15)'
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
    if(state.avgLST > 45) newAlerts.push({id:1,icon:'🔴',text:t('alerts.extremeHeat', 'EXTREME heat: LST > 45°C'),color:'#ff2222'})
    if(liveWeather?.aqi?.usAQI > 300) newAlerts.push({id:2,icon:'🟠',text:t('alerts.highAqi', 'HIGH AQI: > 300'),color:'#ff6b35'})
    if(state.ndbi > 0.5) newAlerts.push({id:3,icon:'🟡',text:t('alerts.moderateHeat', 'MODERATE urban heat'),color:'#ffcc00'})
    if(marineHeatwave && ['Gujarat','Maharashtra','Kerala','Tamil Nadu'].includes(selectedState)) {
      newAlerts.push({id:4,icon:'🔵',text:t('alerts.marineHeatwave', 'Marine heatwave active'),color:'#00a8ff'})
    }
    if(polarVortex === 'DISRUPTED') newAlerts.push({id:5,icon:'🟣',text:t('alerts.polarVortexWatch', 'WATCH: Polar vortex disrupted'),color:'#9d4edd'})
    if(newAlerts.length === 0) newAlerts.push({id:6,icon:'🟢',text:t('alerts.allNormal', 'All values normal'),color:'#00ff88'})

    setAlerts(newAlerts)
  }, [selectedState, selectedCity, marineHeatwave, polarVortex, liveWeather, t])

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
          boxShadow: '0 0 40px rgba(0,212,255,0.1)',
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
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#00d4ff' }}>HeatOps</div>
              <div style={{ fontSize: 10, color: '#00d4ff', fontFamily: 'monospace', letterSpacing: 2 }}>
                URBAN HEAT ISLAND MONITORING SYSTEM
              </div>
            </div>

            <div style={{ display: 'flex', gap: 0, background: '#0a0f1e', borderRadius: 8, padding: 4 }}>
              <button style={{
                flex: 1,
                padding: '8px',
                borderRadius: 6,
                border: 'none',
                background: '#00d4ff',
                color: '#000',
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
                style={{background: "none", border: "none", color: "#00d4ff", cursor: "pointer", textDecoration: "underline"}}
              >
                Forgot password?
              </button>
            </div>

            {forgotMode && (
              <div style={{
                background: "rgba(0,212,255,0.05)",
                border: "1px solid #00d4ff",
                borderRadius: "8px",
                padding: "12px",
                color: "#64748b"
              }}>
                <button 
                  onClick={() => setForgotMode(false)}
                  style={{float: "right", background: "none", border: "none", color: "#00d4ff", cursor: "pointer"}}
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
                    width: '100%', padding: '8px', background: 'rgba(0,212,255,0.2)',
                    border: '1px solid #00d4ff', borderRadius: 6, color: '#00d4ff',
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
              width: '100%', padding: '12px', background: 'linear-gradient(90deg, #00d4ff, #0088cc)',
              border: 'none', borderRadius: 8, color: '#000', fontSize: 15,
              fontWeight: 'bold', cursor: 'pointer', marginTop: 4,
              boxShadow: '0 0 20px rgba(0,212,255,0.3)'
            }}>
              {t('nav.signIn', 'SIGN IN')}
            </button>

            <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>
              HeatOps 2026
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Map screen
  if(screen === "map") {
    const hottest = liveLeaderBase[0]

    return (
      <div className="map-container">
        {/* Floating AI Assistant restored on the map screen so it's always
            reachable without switching screens. It shows a hint when no city
            is selected. */}
        <FloatingAIAssistant
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
          darkMode={darkMode}
          setDarkMode={setDarkMode}
        />

        {/* Main content — updated height calculation */}
        <div style={{
          display: 'flex',
          gap: 16,
          padding: '12px 16px',
          height: 'calc(100vh - 80px)'
        }}>
          {/* Left: India Map */}
          <div style={{
            flex: '0 0 58%',
            position: 'relative'
          }}>
            <div style={{
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
                  border: '1px solid #00d4ff',
                  borderRadius: 8,
                  color: '#00d4ff',
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
                {mapExpanded ? '⛶ MINIMIZE' : '⛶ MAXIMIZE'}
              </button>

              {mapExpanded ? (
                <>
                  <div style={{ marginBottom: 10, padding: '12px 16px 0 16px' }}>
                    <input
                      placeholder={`🔍 ${t('nav.searchPlaceholder', 'Search any city in India...')}`}
                      value={globalSearch}
                      onChange={e => setGlobalSearch(e.target.value)}
                      style={{
                        width: '100%',
                        background: '#0a0e1a',
                        border: '1px solid #1a2a4a',
                        borderRadius: 8,
                        color: '#fff',
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
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: getRiskText(res.risk) }}>{res.lst}°C</div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{res.risk}</div>
                              </div>
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
                        setMapScale(prev => Math.min(Math.max(prev + delta, 0.5), 5))
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
                      <IndiaMap
                        ref={mapTransformRef}
                        INDIA_DATA={INDIA_DATA}
                        selectedState={selectedState}
                        onStateClick={handleStateClick}
                        scale={mapScale}
                        pos={mapPos}
                        isDragging={isDragging}
                      />
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
                        onClick={() => setMapScale(prev => Math.min(prev + 0.3, 5))}
                        style={{
                          width: 36, height: 36,
                          background: 'rgba(0,0,0,0.7)',
                          border: '1px solid #00d4ff',
                          borderRadius: 8,
                          color: '#00d4ff',
                          fontSize: 20,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >+</button>
                      <button
                        onClick={() => setMapScale(prev => Math.max(prev - 0.3, 0.5))}
                        style={{
                          width: 36, height: 36,
                          background: 'rgba(0,0,0,0.7)',
                          border: '1px solid #00d4ff',
                          borderRadius: 8,
                          color: '#00d4ff',
                          fontSize: 20,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >−</button>
                      <button
                        onClick={() => { setMapScale(1); setMapPos({ x: 0, y: 0 }) }}
                        style={{
                          width: 36, height: 36,
                          background: 'rgba(0,0,0,0.7)',
                          border: '1px solid #00d4ff',
                          borderRadius: 8,
                          color: '#00d4ff',
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
                  color: '#00d4ff',
                  fontFamily: 'monospace',
                  letterSpacing: 1,
                  fontSize: 12,
                  gap: 10
                }}>
                  <span style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#00ff88',
                    border: '1.5px solid #ffffff',
                    boxShadow: '0 0 8px 2px rgba(0,255,136,0.8)',
                    animation: 'pulse 1.2s ease-in-out infinite'
                  }} />
                  [ INDIA HEAT MAP — CLICK TO EXPAND ]
                </div>
              )}
            </div>
          </div>

          {/* Right: Info Panel — themed by the CLICKED state's heat category (never
              hover, to avoid any continuous mouse-tracking re-renders). */}
          <div style={{
            flex: '0 0 42%',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflowY: 'auto',
            paddingRight: 4,
            scrollbarWidth: 'thin',
            scrollbarColor: '#1a2a4a #0a0e1a',
            ...(selectedState ? getThemeVars(getAdjustedLST(selectedState)) : {})
          }}>
            {selectedState ? (
              <>
                <div className="state-card">
                  <h3>{selectedState}</h3>
                  <span
                    className="risk-badge"
                    style={{
                      background: getRiskBadgeColor(STATE_DATA[selectedState]?.risk).bg,
                      color: getRiskBadgeColor(STATE_DATA[selectedState]?.risk).text
                    }}
                  >
                    {STATE_DATA[selectedState]?.risk || 'N/A'}
                  </span>
                </div>

                <div className="metrics-grid">
                  <div className="metric-card">
                    <span className="metric-label">LST</span>
                    <span className="metric-value">{getAdjustedLST(selectedState).toFixed(1)}°C</span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-label">NDVI</span>
                    <span className="metric-value">{STATE_DATA[selectedState]?.ndvi.toFixed(2)}</span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-label">NDBI</span>
                    <span className="metric-value">{STATE_DATA[selectedState]?.ndbi.toFixed(2)}</span>
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
                  liveSelectedTemp={liveWeather?.current?.temp}
                  cacheLastUpdated={cacheLastUpdated}
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

                <div className="hottest-section">
                  <h4>🔥 {t('panels.hottestCities', 'Hottest Cities')}</h4>
                  {cacheLastUpdated && (
                    isCacheStale(cacheLastUpdated) ? (
                      <div style={{ fontSize: 9, color: "#ffb020", marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        🟠 {t('panels.dataOutdated', 'Data may be outdated')} · last refresh {formatAgo(cacheLastUpdated)}
                      </div>
                    ) : (
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>
                        📡 Live · updated {formatAgo(cacheLastUpdated)}
                      </div>
                    )
                  )}
                  <ul>
                    {liveLeaderBase.map((item, i) => (
                      <li key={i}>
                        {item.flag} {item.city} <span>{item.temp}°C</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="legend-section">
                  <h4>🌡️ Heat Legend</h4>
                  <div className="legend-item">
                    <span className="legend-dot" style={{background:'#b81010'}}/>Extreme {'>44°C'}
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot" style={{background:'#bb5200'}}/>High {'38-44°C'}
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot" style={{background:'#896e00'}}/>Moderate {'32-38°C'}
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot" style={{background:'#0a6638'}}/>Cool {'<32°C'}
                  </div>
                </div>

                <div className="history-section" style={{marginTop:20, padding:16, border:'1px solid rgba(0,255,136,0.18)', borderRadius:12, background:'rgba(0,0,0,0.35)'}}>
                  <h4 style={{marginBottom:10, color:'#00ff88'}}>🧾 Recent Sign-ins</h4>
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
                  border: '1px solid rgba(0,212,255,0.2)',
                  borderRadius: 12,
                  padding: 16
                }}>
                  <h4 style={{ color: '#00d4ff', borderLeft: '2px solid #00d4ff', paddingLeft: 8, marginBottom: 10, marginTop: 0 }}>
                    📊 {t('nationalSummary.title', "Today's National Heat Summary")}
                  </h4>
                  {cacheLastUpdated && (
                    isCacheStale(cacheLastUpdated) ? (
                      <div style={{ fontSize: 9, color: '#ffb020', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                        🟠 {t('panels.dataOutdated', 'Data may be outdated')} · last refresh {formatAgo(cacheLastUpdated)}
                      </div>
                    ) : (
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
                        📡 {t('nationalSummary.live', 'Live')} · {t('nationalSummary.updated', 'updated')} {formatAgo(cacheLastUpdated)}
                      </div>
                    )
                  )}

                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ background: 'rgba(184,16,16,0.1)', border: '1px solid rgba(184,16,16,0.3)', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>
                        🔥 {t('nationalSummary.hottestNow', 'Hottest city right now')}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#ff6b6b' }}>
                        {liveLeaderBase[0]?.city}, {liveLeaderBase[0]?.state}
                      </div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{liveLeaderBase[0]?.temp}°C</div>
                    </div>

                    <div style={{ background: 'rgba(187,82,0,0.1)', border: '1px solid rgba(187,82,0,0.3)', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>
                        🌡️ {t('nationalSummary.extremeStates', 'States in Extreme/High risk category')}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#ffaa66' }}>
                        {extremeOrHighRiskStateCount} / {Object.keys(STATE_DATA).length}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.3)', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>
                        🇮🇳 {t('nationalSummary.avgTemp', 'Average national temperature')}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#00d4ff' }}>
                        {nationalAvgTemp.toFixed(1)}°C
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 8, paddingLeft: 2 }}>
                    ⚡ {t('nationalSummary.quickPicks', 'Quick Picks')}
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
                          background: 'rgba(0,212,255,0.08)',
                          border: '1px solid rgba(0,212,255,0.3)',
                          borderRadius: 999,
                          color: '#00d4ff',
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '6px 14px',
                          cursor: 'pointer',
                          transition: 'background 0.2s ease, border-color 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(0,212,255,0.22)'
                          e.currentTarget.style.borderColor = 'rgba(0,212,255,0.6)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(0,212,255,0.08)'
                          e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)'
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
    )
  }

  // Dashboard screen (18 panels)
  if(screen === "dashboard") {
    const state = STATE_DATA[selectedState]
    if(!state) return null

    // Get real city data
    const cityData = getCityData(selectedCity, selectedState)
    const lst = cityData.lst
    // Real values for anything cited as data (AI context, exports) — separate from the
    // illustrative `lst`/`state` values still used for theming and the what-if simulator below.
    const realSurfaceTemp = liveWeather?.current?.surfaceTemp
    const realLulcEntry = lulcReal?.cities?.[selectedCity]

    const TABS = ['Overview', 'Analysis', 'Compare', 'Interventions', 'AI + Export']
    const TAB_LABELS = {
      'Overview': t('tabs.overview', 'OVERVIEW'),
      'Analysis': t('tabs.analysis', 'ANALYSIS'),
      'Compare': t('tabs.compare', 'COMPARE'),
      'Interventions': t('tabs.interventions', 'INTERVENTIONS'),
      'AI + Export': t('tabs.aiExport', 'AI + EXPORT')
    }

    return (
      <div className="dashboard-container" style={getThemeVars(lst)}>
        {/* Floating AI Assistant — quick access from any dashboard tab without
            switching to AI+Export, reuses the same AIAnalystPanel/state */}
        <FloatingAIAssistant
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

        {/* Dashboard navbar */}
        <nav className="navbar">
          <div className="nav-left">
            <button onClick={() => setScreen("map")} className="nav-btn">← {t('nav.backToMap', 'Back to Map')}</button>
            <h2>{selectedCity}, {selectedState}</h2>
          </div>
          <div className="nav-right">
            <LanguageDropdown />
            <button onClick={() => setDarkMode(!darkMode)} className="nav-btn">{darkMode ? '☀️' : '🌙'}</button>
            <div className="avatar">{userName[0]?.toUpperCase() || 'K'}</div>
            <button onClick={() => {setScreen("signin"); setUserName("")}} className="nav-btn">{t('nav.signOut', 'Sign Out')}</button>
          </div>
        </nav>

        {/* Dashboard tab bar */}
        <div style={{
          display: 'flex',
          background: '#0a0f1e',
          borderBottom: '1px solid #1a2a4a',
          padding: '0 16px'
        }}>
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
                transition: 'all 0.2s'
              }}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        <div className="dashboard-scroll">
          {activeTab === 'Overview' && (
            <div className="dashboard-content">
              <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
                {/* PANEL A: Weather Conditions — single source of truth is the live Open-Meteo WeatherCard.
                    The old static/estimated Temperature/Humidity/Wind/AQI cards (Landsat/ERA5/CPCB-labeled
                    placeholder values) have been removed entirely per data-accuracy fix. */}
                <section className="panel">
                  <h3>🌡️ {t('panels.weatherConditions', 'WEATHER CONDITIONS')}</h3>
                  <WeatherCard city={selectedCity} state={selectedState} onClose={() => {}} />
                  {/* Year-over-year comparison — additive stat, derived from existing 10-year trend data */}
                  {(() => {
                    const currentTemp = liveWeather?.current?.temp
                    const yoy = getYoYComparison(selectedCity, cityData, currentTemp)
                    if (!yoy) return null
                    const arrow = yoy.delta > 0 ? '▲' : yoy.delta < 0 ? '▼' : '–'
                    const deltaColor = yoy.delta > 0 ? '#ff6b35' : yoy.delta < 0 ? '#00a8ff' : 'rgba(255,255,255,0.5)'
                    return (
                      <div style={{
                        marginTop: 10,
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        <span>{t('yoyComparison.today', 'Today')}: <strong style={{color:'#fff'}}>{currentTemp}°C</strong></span>
                        <span>—</span>
                        <span>{t('yoyComparison.sameDateLastYear', 'Same date last year')}: <strong style={{color:'#fff'}}>{yoy.lastYearTemp}°C</strong></span>
                        <span style={{color: deltaColor, fontWeight: 700}}>
                          ({arrow} {Math.abs(yoy.delta)}°C)
                        </span>
                      </div>
                    )
                  })()}
                </section>

                {/* PANEL G: Day vs Night */}
                <section className="panel">
                  <h3>📊 {t('panels.dayNightTemp', 'DAY vs NIGHT TEMPERATURE')}</h3>
                  <div className="comparison-bar">
                    <div className="bar-item">
                      <span>{t('dayNight.day', 'Day (12 PM)')}</span>
                      <div className="bar" style={{background:'#ff6b35', width:'70%'}}/>
                      <span>{getDayNightData(cityData, selectedCity)[5]?.day.toFixed(1) || (cityData.lst + 3).toFixed(1)}°C</span>
                    </div>
                    <div className="bar-item">
                      <span>{t('dayNight.night', 'Night (12 AM)')}</span>
                      <div className="bar" style={{background:'#0066ff', width:'50%'}}/>
                      <span>{getDayNightData(cityData, selectedCity)[5]?.night.toFixed(1) || (cityData.lst - 8).toFixed(1)}°C</span>
                    </div>
                  </div>
                </section>
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
                {/* PANEL B: Satellite Indices — every card below shows either a real, live
                    value or an explicit "not available" state. Nothing here is estimated/
                    seeded; see the Random Forest panel disclosure for the same standard
                    applied to the ML model. */}
                <section className="panel">
                  <h3>🔥 {t('panels.satelliteIndices', 'SATELLITE INDICES')}</h3>
                  <div className="indices-grid">
                    <div className="index-card">
                      <span>Surface Temp (live)</span>
                      {typeof liveWeather?.current?.surfaceTemp === 'number' ? (
                        <>
                          <div className="progress-bar">
                            <div className="progress" style={{width: (liveWeather.current.surfaceTemp/55)*100 + '%', background:'linear-gradient(90deg, #0a6638, #896e00, #bb5200, #b81010)'}}/>
                          </div>
                          <span className="index-value">{liveWeather.current.surfaceTemp.toFixed(1)}°C</span>
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
                            <span>NDVI / NDBI / NDWI</span>
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
                              <div style={{fontSize: 10, color: 'rgba(255,204,0,0.85)', lineHeight: 1.5}}>
                                📍 {t('satellitePass.lulcFallback', 'No real classification for {{city}} itself — showing nearest available real data point ({{fallbackCity}}) below, as an estimate.', { city: selectedCity, fallbackCity: lulcEntry.fallbackCity })}
                              </div>
                            </div>
                          )}
                          <div className="index-card">
                            <span>Vegetation Fraction</span>
                            <div className="progress-bar">
                              <div className="progress" style={{width: lulcEntry.vegetation + '%', background:'#00ff88'}}/>
                            </div>
                            <span className="index-value">{lulcEntry.vegetation}%</span>
                            <SourceBadge source={`ESA WorldCover 10m (2021) — real proxy for NDVI, not the spectral index itself${fallbackSuffix}`} />
                          </div>
                          <div className="index-card">
                            <span>Built-up Fraction</span>
                            <div className="progress-bar">
                              <div className="progress" style={{width: lulcEntry.builtUp + '%', background:'#ff6b35'}}/>
                            </div>
                            <span className="index-value">{lulcEntry.builtUp}%</span>
                            <SourceBadge source={`ESA WorldCover 10m (2021) — real proxy for NDBI, not the spectral index itself${fallbackSuffix}`} />
                          </div>
                          <div className="index-card">
                            <span>Water Fraction</span>
                            <div className="progress-bar">
                              <div className="progress" style={{width: Math.min(100, lulcEntry.water * 3) + '%', background:'#00a8ff'}}/>
                            </div>
                            <span className="index-value">{lulcEntry.water}%</span>
                            <SourceBadge source={`ESA WorldCover 10m (2021) — real proxy for NDWI, not the spectral index itself${fallbackSuffix}`} />
                          </div>
                        </>
                      )
                    })()}
                    <div className="index-card">
                      <span>Elevation</span>
                      {typeof liveWeather?.elevation === 'number' ? (
                        <>
                          <div className="progress-bar">
                            <div className="progress" style={{width: Math.min(100, (liveWeather.elevation/3000)*100) + '%', background:'#888'}}/>
                          </div>
                          <span className="index-value">{Math.round(liveWeather.elevation)}m</span>
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
                <section className="panel">
                  <h3>⚠️ {t('panels.heatRiskGauge', 'HEAT RISK GAUGE')}</h3>
                  <div className="gauge-container">
                    <svg width="200" height="120" viewBox="0 0 200 120">
                      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#0a6638" strokeWidth="8"/>
                      <path d="M 20 100 A 80 80 0 0 1 70 35" fill="none" stroke="#ffcc00" strokeWidth="8"/>
                      <path d="M 70 35 A 80 80 0 0 1 130 25" fill="none" stroke="#ff6b35" strokeWidth="8"/>
                      <path d="M 130 25 A 80 80 0 0 1 180 100" fill="none" stroke="#b81010" strokeWidth="8"/>
                      <circle cx="100" cy="100" r="4" fill="#fff"/>
                    </svg>
                    <div className="risk-label">
                      {state.risk === 'EXTREME' && '🔴 EXTREME'}
                      {state.risk === 'HIGH' && '🟠 HIGH'}
                      {state.risk === 'MODERATE' && '🟡 MODERATE'}
                      {state.risk === 'COOL' && '🟢 COOL'}
                    </div>
                  </div>
                </section>

                {/* PANEL K: Alerts */}
                <section className="panel">
                  <h3>🚨 {t('panels.activeAlerts', 'ACTIVE ALERTS')} ({alerts.length})</h3>
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
                    <section className="panel" style={info ? { borderLeft: `4px solid ${info.color}` } : undefined}>
                      <h3>🩺 {t('panels.healthSafety', 'HEALTH & SAFETY PRECAUTIONS')}</h3>
                      {info ? (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 700, color: info.color, marginBottom: 10, letterSpacing: '0.05em' }}>
                            {info.category} · {precautionTemp}°C
                            {liveWeatherStale && (
                              <span style={{ marginLeft: 10, fontSize: 10, fontWeight: 400, fontStyle: 'italic', color: 'rgba(255,200,100,0.8)' }}>
                                ⏱ Cached — {Math.round((Date.now() - (liveWeatherCachedAt || Date.now())) / 60000)} min ago
                                <button
                                  onClick={forceRefreshLiveWeather}
                                  style={{
                                    marginLeft: 8, fontSize: 9, padding: '2px 8px', borderRadius: 4,
                                    background: 'rgba(255,200,100,0.1)', border: '1px solid rgba(255,200,100,0.3)',
                                    color: 'rgba(255,200,100,0.9)', cursor: 'pointer', fontWeight: 600, fontStyle: 'normal'
                                  }}
                                >↻ Force Refresh</button>
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
                          ⚠️ Weather unavailable
                          <button
                            onClick={forceRefreshLiveWeather}
                            style={{
                              marginLeft: 10, fontSize: 11, padding: '4px 10px', borderRadius: 6,
                              background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)',
                              color: '#22c55e', cursor: 'pointer', fontWeight: 600
                            }}
                          >↻ Force Refresh</button>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Loading live temperature...</div>
                      )}
                    </section>
                  )
                })()}

                {/* PANEL J: Climate Oscillations */}
                <section className="panel">
                  <h3>🌐 {t('panels.climateOscillations', 'GLOBAL CLIMATE SYSTEMS')}</h3>
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
                  <h3>🔥 {t('panels.heatmapGrid', 'TEMPERATURE HEATMAP GRID')}</h3>
                  <div style={{marginBottom: "12px", fontSize: "11px", color: "rgba(255,255,255,0.6)"}}>
                    🌳 {t('physics.items.urbanGreening', 'Urban Greening')}: <strong>{(treeSlider*18).toFixed(1)}°C</strong> | 🏠 {t('physics.items.coolRoofs', 'Cool Roofs')}: <strong>{(roofSlider*14).toFixed(1)}°C</strong> | 💧 {t('physics.items.waterBodies', 'Water Bodies')}: <strong>{(waterSlider*12).toFixed(1)}°C</strong>
                  </div>
                  <div className="heatmap-section">
                    <div className="grid-heatmap">
                      {Array.from({length:100}).map((_, i) => {
                        const row = Math.floor(i / 10)
                        const col = i % 10
                        const cellTemp = getCellTemp(cityData.lst, row, col, treeSlider, roofSlider, waterSlider)
                        let color = '#1a3a0d'
                        if(cellTemp < 35) color = '#0066ff'
                        else if(cellTemp < 38) color = '#00ff88'
                        else if(cellTemp < 41) color = '#ffcc00'
                        else if(cellTemp < 44) color = '#ff6b35'
                        else color = '#b81010'

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
                <MLModelPanel mlModel={mlModelReal} cityName={selectedCity} />

                {/* PANEL L: Land Use / Land Cover */}
                <LandCoverPanel lulcData={lulcReal} cityName={selectedCity} stateName={selectedState} coordsData={cityCoordsData} />

                {/* PANEL M: Urban Morphology (OpenStreetMap, live, real) */}
                <section className="panel">
                  <h3>🏙️ {t('panels.urbanMorphology', 'URBAN MORPHOLOGY')}</h3>
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
                          <div style={{fontSize: 22, fontWeight: 700, color: '#ffa83c'}}>{osmDensity.buildingCount}</div>
                          <div style={{fontSize: 10, color: 'rgba(255,255,255,0.5)'}}>{t('osm.buildings', 'buildings within {{radius}}m', {radius: osmDensity.radiusM})}</div>
                        </div>
                        <div>
                          <div style={{fontSize: 22, fontWeight: 700, color: '#ffa83c'}}>{osmDensity.densityPerSqKm}</div>
                          <div style={{fontSize: 10, color: 'rgba(255,255,255,0.5)'}}>{t('osm.perSqKm', 'buildings / km²')}</div>
                        </div>
                      </div>
                      <SourceBadge source="OpenStreetMap (Overpass API, live)" />
                    </>
                  )}
                </section>

                {/* PANEL H: Historical Trend */}
                <section className="panel">
                  <h3>📈 {t('panels.historicalTrend', '10-YEAR TREND (2015-2025)')}</h3>
                  {(() => {
                    const histData = getHistoricalData(selectedCity, cityData)
                    const urban2015 = histData[0].urban
                    const urbanNow = histData[5].urban
                    const urbanChange = urbanNow - urban2015
                    const ruralChange = histData[5].rural - histData[0].rural
                    return (
                      <div className="trend-chart">
                        <p>{t('historicalTrend.urbanCore', 'Urban Core')}: {urbanChange > 0 ? '+' : ''}{urbanChange.toFixed(1)}°C {t('historicalTrend.warmer', 'warmer')}</p>
                        <p>{t('historicalTrend.ruralAreas', 'Rural Areas')}: {ruralChange > 0 ? '+' : ''}{ruralChange.toFixed(1)}°C {t('historicalTrend.warmer', 'warmer')}</p>
                        <div className="trend-bar">
                          <div className="trend-urban" style={{height: Math.min(100, Math.abs(urbanChange)*10) + '%'}}/>
                          <div className="trend-rural" style={{height: Math.min(100, Math.abs(ruralChange)*10) + '%'}}/>
                        </div>
                      </div>
                    )
                  })()}
                </section>

                {/* Historical Heatwave Timeline — additive card, derived from the same
                    seeded 10-year urban LST trend used above (getHeatwaveEvents) */}
                <section className="panel">
                  <h3>🔥 {t('panels.heatwaveTimeline', 'HISTORICAL HEATWAVE TIMELINE')}</h3>
                  {(() => {
                    const events = getHeatwaveEvents(selectedCity, cityData)
                    if (events.length === 0) {
                      return (
                        <div style={{fontSize: 12, color: 'rgba(255,255,255,0.4)'}}>
                          {t('heatwaveTimeline.noEvents', 'No significant heatwave events recorded for this city in the historical window.')}
                        </div>
                      )
                    }
                    return (
                      <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                        {events.map((ev, i) => (
                          <div key={i} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'rgba(255,107,53,0.06)',
                            border: '1px solid rgba(255,107,53,0.15)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            fontSize: 12
                          }}>
                            <span style={{color: '#fff', fontWeight: 600}}>{ev.date}</span>
                            <span style={{color: '#ff6b35'}}>{t('heatwaveTimeline.peakTemp', 'Peak temp')}: <strong>{ev.peakTemp}°C</strong></span>
                            <span style={{color: 'rgba(255,255,255,0.6)'}}>{t('heatwaveTimeline.duration', 'duration')}: {ev.durationDays} {t('heatwaveTimeline.days', 'days')}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </section>

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
                {/* PANEL F: Intervention Sliders (kept — duplicate "Cooling Interventions" panel removed) */}
                <section className="panel">
                  <h3>🎛️ {t('panels.interventionSliders', 'UHI INTERVENTIONS (Real-time cooling)')}</h3>
                  <div style={{display: "grid", gap: "14px"}}>
                    <div>
                      <label style={{fontSize: "12px", color: "#00ff88", fontWeight: "700"}}>
                        {t('sliders.urbanGreening', '🌳 Urban Greening (NDVI +0.3):')} {(treeSlider*100).toFixed(0)}%
                      </label>
                      <input type="range" min="0" max="0.3" step="0.01" value={treeSlider}
                        onChange={e => setTreeSlider(parseFloat(e.target.value))}
                        style={{width: "100%", marginTop: "6px"}}
                      />
                      <div style={{fontSize: "10px", color: "rgba(255,255,255,0.5)", marginTop: "4px"}}>
                        Cooling potential: {(treeSlider*18).toFixed(1)}°C
                      </div>
                    </div>
                    <div>
                      <label style={{fontSize: "12px", color: "#ffcc00", fontWeight: "700"}}>
                        {t('sliders.coolRoofs', '🏠 Cool Roofs (Albedo +0.2):')} {(roofSlider*100).toFixed(0)}%
                      </label>
                      <input type="range" min="0" max="0.2" step="0.01" value={roofSlider}
                        onChange={e => setRoofSlider(parseFloat(e.target.value))}
                        style={{width: "100%", marginTop: "6px"}}
                      />
                      <div style={{fontSize: "10px", color: "rgba(255,255,255,0.5)", marginTop: "4px"}}>
                        Cooling potential: {(roofSlider*14).toFixed(1)}°C
                      </div>
                    </div>
                    <div>
                      <label style={{fontSize: "12px", color: "#0088ff", fontWeight: "700"}}>
                        {t('sliders.waterBodies', '💧 Water Bodies (NDWI +0.1):')} {(waterSlider*100).toFixed(0)}%
                      </label>
                      <input type="range" min="0" max="0.1" step="0.01" value={waterSlider}
                        onChange={e => setWaterSlider(parseFloat(e.target.value))}
                        style={{width: "100%", marginTop: "6px"}}
                      />
                      <div style={{fontSize: "10px", color: "rgba(255,255,255,0.5)", marginTop: "4px"}}>
                        Cooling potential: {(waterSlider*12).toFixed(1)}°C
                      </div>
                    </div>
                  </div>
                </section>

                {/* PANEL I: Physics Explanation */}
                <PhysicsPanel cityData={cityData} />
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
                {/* PANEL J: Spatial Recommendation */}
                <SpatialRecommendation cityData={cityData} cityName={selectedCity} />

                {/* Wind & Atmosphere */}
                <section className="panel">
                  <h3>💨 {t('panels.windAtmosphere', 'WIND & ATMOSPHERE')}</h3>
                  <div className="wind-stats">
                    <div>🧭 {t('windAtmosphere.direction', 'Direction')}: NE 45°</div>
                    <div>💨 {t('windAtmosphere.speed', 'Speed')}: 12 km/h</div>
                    <div>🌪️ {t('windAtmosphere.gust', 'Gust')}: 22 km/h</div>
                    <div>🔽 {t('windAtmosphere.pressure', 'Pressure')}: 1013 mb</div>
                  </div>
                </section>

                {/* Pollen & Air Quality */}
                <section className="panel">
                  <h3>🌿 {t('panels.pollenAirQuality', 'POLLEN & AIR QUALITY')}</h3>
                  <div className="pollen-grid">
                    <div className="pollen-card">🌾 {t('pollen.grass', 'Grass')}: {t('pollen.moderate', 'MODERATE')}</div>
                    <div className="pollen-card">🌳 {t('pollen.tree', 'Tree')}: {t('pollen.high', 'HIGH')}</div>
                    <div className="pollen-card">🌿 {t('pollen.weed', 'Weed')}: {t('pollen.low', 'LOW')}</div>
                    <div className="pollen-card">🍄 {t('pollen.mold', 'Mold')}: {t('pollen.moderate', 'MODERATE')}</div>
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
                  <h3>🤖 {t('panels.aiAnalyst', 'AI ANALYST')}</h3>
                  <AIAnalystPanel
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
                </section>

                {/* PANEL M: Gamification */}
                <section className="panel">
                  <h3>⭐ {t('panels.gamification', 'POINTS & BADGES')}</h3>
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
                  <h3>📖 {t('panels.glossary', 'GLOSSARY')} {showGlossary && '✓'}</h3>
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
                  <h3>📤 {t('panels.exportShare', 'EXPORT & SHARE')}</h3>
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
                    }}>📋 {t('buttons.copySummary', 'Copy Summary')}</button>
                    <button onClick={() => {
                      const surfaceTemp = liveWeather?.current?.surfaceTemp
                      const msg = `Check out ${selectedCity} heat analysis on HeatOps! Surface Temp: ${typeof surfaceTemp === 'number' ? surfaceTemp.toFixed(1) + '°C (live)' : 'N/A'} | Risk: ${state.risk}`
                      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`)
                    }}>📱 {t('buttons.whatsappShare', 'WhatsApp Share')}</button>
                    <button onClick={() => {
                      const surfaceTemp = liveWeather?.current?.surfaceTemp
                      const lulcEntry = getLulcWithFallback(selectedCity, selectedState, lulcReal, cityCoordsData)
                      const vegCell = lulcEntry ? `${lulcEntry.vegetation}${lulcEntry.isFallback ? ` (est. from ${lulcEntry.fallbackCity})` : ''}` : 'N/A'
                      const builtCell = lulcEntry ? `${lulcEntry.builtUp}${lulcEntry.isFallback ? ` (est. from ${lulcEntry.fallbackCity})` : ''}` : 'N/A'
                      const csv = `City,State,SurfaceTempC_live,VegetationPct_WorldCover,BuiltUpPct_WorldCover,AQI_live,Risk\n${selectedCity},${selectedState},${typeof surfaceTemp === 'number' ? surfaceTemp.toFixed(1) : 'N/A'},${vegCell},${builtCell},${liveWeather?.aqi?.usAQI ?? 'N/A'},${state.risk}`
                      const blob = new Blob([csv], {type:'text/csv'})
                      const url = window.URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${selectedCity}-analysis.csv`
                      a.click()
                    }}>📊 {t('buttons.csvDownload', 'CSV Download')}</button>
                  </div>
                </section>

                {/* PANEL O: Progress Tracker */}
                <section className="panel">
                  <h3>📋 {t('panels.progressTracker', 'HeatOps 2026 PROGRESS')}</h3>
                  <div className="progress-list">
                    <div>{t('progressTracker.dataCollection', '✅ Data Collection (Open-Meteo + ESA WorldCover)')}</div>
                    <div>{t('progressTracker.lstCalculation', '✅ Live Surface Temperature')}</div>
                    <div>{t('progressTracker.indexCalculation', '✅ Vegetation/Built-up Fractions (36 cities)')}</div>
                    <div>{t('progressTracker.correlationAnalysis', '✅ Correlation Analysis')}</div>
                    <div>{t('progressTracker.randomForestModel', '✅ Random Forest Model')}</div>
                    <div>{t('progressTracker.interventionSimulation', '✅ Intervention Simulation')}</div>
                    <div>{t('progressTracker.dashboardCreation', '✅ Dashboard Creation')}</div>
                    <div>{t('progressTracker.reportSubmission', '🔲 Report Submission')}</div>
                  </div>
                  <div className="progress-bar-main">
                    <div className="progress" style={{width: '87.5%'}}/>
                  </div>
                  <p className="progress-text">7/8 Steps Complete</p>
                </section>

                {/* PANEL R: About & Team */}
                <section className="panel">
                  <h3>👥 {t('panels.aboutTeam', 'TEAM & METHODOLOGY')}</h3>
                  <div className="about-card">
                    <h4>HeatOps 2026: Urban Heat Island Mitigation</h4>
                    <p><strong>College:</strong> [Removed]</p>
                    <p><strong>Method:</strong> Open-Meteo (live) + ESA WorldCover + Random Forest ML</p>
                    <p><strong>Focus:</strong> Delhi NCR & Indian Urban Heat Islands</p>
                    <p><strong>Team:</strong> Heatwave Mitigation Initiative</p>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
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
          </section>

          <section className="panel">
            <h3>⭐ {t('panels.gamification', 'POINTS & BADGES')}</h3>
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
            <h3>🕓 {t('panels.recentSignIns', 'Recent Sign-ins')}</h3>
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
          <h1 style={{ fontSize: 20, color: '#00d4ff', margin: 0 }}>
            🛡️ Admin Analytics Dashboard
          </h1>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setDarkMode(!darkMode)} style={{
              background: 'rgba(0,212,255,0.1)',
              border: '1px solid #00d4ff',
              color: '#00d4ff',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px'
            }}>
              {darkMode ? '☀️' : '🌙'}
            </button>
            <button onClick={() => { setScreen("signin"); setUserName("") }} style={{
              background: 'rgba(255,107,53,0.1)',
              border: '1px solid #ff6b35',
              color: '#ff6b35',
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
            background: 'rgba(0,255,136,0.1)',
            border: '1px solid rgba(0,255,136,0.2)',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              {t('admin.totalUsers', 'Total Users')}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#00ff88' }}>
              {analytics.users?.length || 0}
            </div>
          </div>

          <div style={{
            background: 'rgba(0,212,255,0.1)',
            border: '1px solid rgba(0,212,255,0.2)',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              {t('admin.totalLoginEvents', 'Total Login Events')}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#00d4ff' }}>
              {analytics.history?.length || 0}
            </div>
          </div>

          <div style={{
            background: 'rgba(255,204,0,0.1)',
            border: '1px solid rgba(255,204,0,0.2)',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              {t('admin.citiesAnalyzed', 'Cities Analyzed')}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffcc00' }}>
              {Object.keys(analytics.cityCount || {}).length}
            </div>
          </div>

          <div style={{
            background: 'rgba(255,107,53,0.1)',
            border: '1px solid rgba(255,107,53,0.2)',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              {t('admin.successRate', 'Success Rate')}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff6b35' }}>
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
            <h3 style={{ margin: '0 0 12px 0', color: '#00d4ff' }}>{t('admin.hourlyLoginPattern', '📊 Hourly Login Pattern')}</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3,3" stroke="#1a2a4a" />
                <XAxis dataKey="hour" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ background: '#0a0e1a', border: '1px solid #1a2a4a' }} />
                <Line type="monotone" dataKey="logins" stroke="#00d4ff" dot={false} />
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
            <h3 style={{ margin: '0 0 12px 0', color: '#00ff88' }}>{t('admin.dailyLoginTrend', '📈 Daily Login Trend (30 days)')}</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3,3" stroke="#1a2a4a" />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ background: '#0a0e1a', border: '1px solid #1a2a4a' }} />
                <Bar dataKey="success" stackId="a" fill="#00ff88" />
                <Bar dataKey="failed" stackId="a" fill="#ff6b35" />
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
          <h3 style={{ margin: '0 0 12px 0', color: '#ffcc00' }}>{t('admin.topCitiesAnalyzed', '🏙️ Top 10 Cities Analyzed')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart layout="vertical" data={cityCountData}>
              <CartesianGrid strokeDasharray="3,3" stroke="#1a2a4a" />
              <XAxis type="number" stroke="#64748b" />
              <YAxis dataKey="name" type="category" stroke="#64748b" width={100} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0a0e1a', border: '1px solid #1a2a4a' }} />
              <Bar dataKey="value" fill="#ffcc00" />
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
          <h3 style={{ margin: '0 0 12px 0', color: '#ff6b35' }}>{t('admin.recentLoginActivity', '📝 Recent Login Activity')}</h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px'
            }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a2a4a' }}>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#00d4ff' }}>{t('admin.tableUser', 'User')}</th>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#00d4ff' }}>{t('admin.tableEmail', 'Email')}</th>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#00d4ff' }}>{t('admin.tableTime', 'Time')}</th>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#00d4ff' }}>{t('admin.tableStatus', 'Status')}</th>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#00d4ff' }}>{t('admin.tableDuration', 'Duration')}</th>
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
                      color: entry.status === 'success' ? '#00ff88' : '#ff6b35'
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
