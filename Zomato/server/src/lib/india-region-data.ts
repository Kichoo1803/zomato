const INDIA_REGION_DATA = `
Andaman and Nicobar Islands|Nicobars;North and Middle Andaman;South Andamans
Andhra Pradesh|Alluri Sitharama Raju;Anakapalli;Anantapur;Annamayya;Bapatla;Chittoor;East Godavari;Eluru;Guntur;Kakinada;Konaseema;Krishna;Kurnool;Nandyal;NTR;Palnadu;Parvathipuram Manyam;Prakasam;SPSR Nellore;Sri Sathya Sai;Srikakulam;Tirupati;Visakhapatnam;Vizianagaram;West Godavari;Y.S.R.
Arunachal Pradesh|Anjaw;Changlang;Dibang Valley;East Kameng;East Siang;Kamle;Kra Daadi;Kurung Kumey;Leparada;Lohit;Longding;Lower Dibang Valley;Lower Siang;Lower Subansiri;Namsai;Pakke Kessang;Papum Pare;Shi Yomi;Siang;Tawang;Tirap;Upper Siang;Upper Subansiri;West Kameng;West Siang
Assam|Bajali;Baksa;Barpeta;Biswanath;Bongaigaon;Cachar;Charaideo;Chirang;Darrang;Dhemaji;Dhubri;Dibrugarh;Dima Hasao;Goalpara;Golaghat;Hailakandi;Hojai;Jorhat;Kamrup;Kamrup Metro;Karbi Anglong;Karimganj;Kokrajhar;Lakhimpur;Majuli;Marigaon;Nagaon;Nalbari;Sivasagar;Sonitpur;South Salmara Mancachar;Tamulpur;Tinsukia;Udalguri;West Karbi Anglong
Bihar|Araria;Arwal;Aurangabad;Banka;Begusarai;Bhagalpur;Bhojpur;Buxar;Darbhanga;Gaya;Gopalganj;Jamui;Jehanabad;Kaimur (Bhabua);Katihar;Khagaria;Kishanganj;Lakhisarai;Madhepura;Madhubani;Munger;Muzaffarpur;Nalanda;Nawada;Pashchim Champaran;Patna;Purbi Champaran;Purnia;Rohtas;Saharsa;Samastipur;Saran;Sheikhpura;Sheohar;Sitamarhi;Siwan;Supaul;Vaishali
Chandigarh|Chandigarh
Chhattisgarh|Balod;Baloda Bazar;Balrampur;Bastar;Bemetara;Bijapur;Bilaspur;Dantewada;Dhamtari;Durg;Gariyaband;Gaurela-Pendra-Marwahi;Janjgir-Champa;Jashpur;Kabirdham;Kanker;Khairgarh Chhuikhadan Gandai;Kondagaon;Korba;Korea;Mahasamund;Manendragarh Chirimiri Bharatpur;Mohla Manpur Ambagarh Chouki;Mungeli;Narayanpur;Raigarh;Raipur;Rajnandgaon;Sakti;Sarangarh Bilaigarh;Sukma;Surajpur;Surguja
Dadra and Nagar Haveli and Daman and Diu|Dadra and Nagar Haveli;Daman;Diu
Delhi|Central;East;New Delhi;North;North East;North West;Shahdara;South;South East;South West;West
Goa|North Goa;South Goa
Gujarat|Ahmedabad;Amreli;Anand;Arvalli;Banas Kantha;Bharuch;Bhavnagar;Botad;Chhotaudepur;Dahod;Dangs;Devbhumi Dwarka;Gandhinagar;Gir Somnath;Jamnagar;Junagadh;Kachchh;Kheda;Mahesana;Mahisagar;Morbi;Narmada;Navsari;Panch Mahals;Patan;Porbandar;Rajkot;Sabar Kantha;Surat;Surendranagar;Tapi;Vadodara;Valsad
Haryana|Ambala;Bhiwani;Charki Dadri;Faridabad;Fatehabad;Gurugram;Hisar;Jhajjar;Jind;Kaithal;Karnal;Kurukshetra;Mahendragarh;Nuh;Palwal;Panchkula;Panipat;Rewari;Rohtak;Sirsa;Sonipat;Yamunanagar
Himachal Pradesh|Bilaspur;Chamba;Hamirpur;Kangra;Kinnaur;Kullu;Lahul and Spiti;Mandi;Shimla;Sirmaur;Solan;Una
Jammu and Kashmir|Anantnag;Bandipora;Baramulla;Budgam;Doda;Ganderbal;Jammu;Kathua;Kishtwar;Kulgam;Kupwara;Poonch;Pulwama;Rajouri;Ramban;Reasi;Samba;Shopian;Srinagar;Udhampur
Jharkhand|Bokaro;Chatra;Deoghar;Dhanbad;Dumka;East Singhbum;Garhwa;Giridih;Godda;Gumla;Hazaribagh;Jamtara;Khunti;Koderma;Latehar;Lohardaga;Pakur;Palamu;Ramgarh;Ranchi;Sahebganj;Saraikela Kharsawan;Simdega;West Singhbhum
Karnataka|Bagalkote;Ballari;Belagavi;Bengaluru Rural;Bengaluru Urban;Bidar;Chamarajanagara;Chikkaballapura;Chikkamagaluru;Chitradurga;Dakshina Kannada;Davangere;Dharwad;Gadag;Hassan;Haveri;Kalaburagi;Kodagu;Kolar;Koppal;Mandya;Mysuru;Raichur;Ramanagara;Shivamogga;Tumakuru;Udupi;Uttara Kannada;Vijayanagar;Vijayapura;Yadgir
Kerala|Alappuzha;Ernakulam;Idukki;Kannur;Kasaragod;Kollam;Kottayam;Kozhikode;Malappuram;Palakkad;Pathanamthitta;Thiruvananthapuram;Thrissur;Wayanad
Ladakh|Kargil;Leh Ladakh
Lakshadweep|Lakshadweep District
Madhya Pradesh|Agar Malwa;Alirajpur;Anuppur;Ashoknagar;Balaghat;Barwani;Betul;Bhind;Bhopal;Burhanpur;Chhatarpur;Chhindwara;Damoh;Datia;Dewas;Dhar;Dindori;East Nimar;Guna;Gwalior;Harda;Indore;Jabalpur;Jhabua;Katni;Khargone;Mandla;Mandsaur;Morena;Narmadapuram;Narsinghpur;Neemuch;Niwari;Panna;Raisen;Rajgarh;Ratlam;Rewa;Sagar;Satna;Sehore;Seoni;Shahdol;Shajapur;Sheopur;Shivpuri;Sidhi;Singrauli;Tikamgarh;Ujjain;Umaria;Vidisha
Maharashtra|Ahmednagar;Akola;Amravati;Aurangabad;Beed;Bhandara;Buldhana;Chandrapur;Dhule;Gadchiroli;Gondia;Hingoli;Jalgaon;Jalna;Kolhapur;Latur;Mumbai;Mumbai Suburban;Nagpur;Nanded;Nandurbar;Nashik;Osmanabad;Palghar;Parbhani;Pune;Raigad;Ratnagiri;Sangli;Satara;Sindhudurg;Solapur;Thane;Wardha;Washim;Yavatmal
Manipur|Bishnupur;Chandel;Churachandpur;Imphal East;Imphal West;Jiribam;Kakching;Kamjong;Kangpokpi;Noney;Pherzawl;Senapati;Tamenglong;Tengnoupal;Thoubal;Ukhrul
Meghalaya|East Garo Hills;East Jaintia Hills;East Khasi Hills;Eastern West Khasi Hills;North Garo Hills;Ri Bhoi;South Garo Hills;South West Garo Hills;South West Khasi Hills;West Garo Hills;West Jaintia Hills;West Khasi Hills
Mizoram|Aizawl;Champhai;Hnahthial;Khawzawl;Kolasib;Lawngtlai;Lunglei;Mamit;Saiha;Saitual;Serchhip
Nagaland|Chumoukedima;Dimapur;Kiphire;Kohima;Longleng;Mokokchung;Mon;Noklak;Peren;Phek;Tseminyu;Tuensang;Wokha;Zunheboto
Odisha|Anugul;Balangir;Baleshwar;Bargarh;Bhadrak;Boudh;Cuttack;Deogarh;Dhenkanal;Gajapati;Ganjam;Jagatsinghapur;Jajapur;Jharsuguda;Kalahandi;Kandhamal;Kendrapara;Kendujhar;Khordha;Koraput;Malkangiri;Mayurbhanj;Nabarangpur;Nayagarh;Nuapada;Puri;Rayagada;Sambalpur;Sonepur;Sundargarh
Puducherry|Karaikal;Mahe;Puducherry;Yanam
Punjab|Amritsar;Barnala;Bathinda;Faridkot;Fatehgarh Sahib;Fazilka;Ferozepur;Gurdaspur;Hoshiarpur;Jalandhar;Kapurthala;Ludhiana;Malerkotla;Mansa;Moga;Pathankot;Patiala;Rupnagar;S.A.S Nagar;Sangrur;Shahid Bhagat Singh Nagar;Sri Muktsar Sahib;Tarn Taran
Rajasthan|Ajmer;Alwar;Banswara;Baran;Barmer;Bharatpur;Bhilwara;Bikaner;Bundi;Chittorgarh;Churu;Dausa;Dholpur;Dungarpur;Ganganagar;Hanumangarh;Jaipur;Jaisalmer;Jalore;Jhalawar;Jhunjhunu;Jodhpur;Karauli;Kota;Nagaur;Pali;Pratapgarh;Rajsamand;Sawai Madhopur;Sikar;Sirohi;Tonk;Udaipur
Sikkim|Gangtok;Gyalshing;Mangan;Namchi;Pakyong;Soreng
Tamil Nadu|Ariyalur;Chengalpattu;Chennai;Coimbatore;Cuddalore;Dharmapuri;Dindigul;Erode;Kallakurichi;Kancheepuram;Kanniyakumari;Karur;Krishnagiri;Madurai;Mayiladuthurai;Nagapattinam;Namakkal;Perambalur;Pudukkottai;Ramanathapuram;Ranipet;Salem;Sivaganga;Tenkasi;Thanjavur;The Nilgiris;Theni;Thiruvallur;Thiruvarur;Tiruchirappalli;Tirunelveli;Tirupathur;Tiruppur;Tiruvannamalai;Tuticorin;Vellore;Villupuram;Virudhunagar
Telangana|Adilabad;Bhadradri Kothagudem;Hanumakonda;Hyderabad;Jagitial;Jangoan;Jayashankar Bhupalapally;Jogulamba Gadwal;Kamareddy;Karimnagar;Khammam;Kumuram Bheem Asifabad;Mahabubabad;Mahabubnagar;Mancherial;Medak;Medchal Malkajgiri;Mulugu;Nagarkurnool;Nalgonda;Narayanpet;Nirmal;Nizamabad;Peddapalli;Rajanna Sircilla;Ranga Reddy;Sangareddy;Siddipet;Suryapet;Vikarabad;Wanaparthy;Warangal;Yadadri Bhuvanagiri
Tripura|Dhalai;Gomati;Khowai;North Tripura;Sepahijala;South Tripura;Unakoti;West Tripura
Uttar Pradesh|Agra;Aligarh;Ambedkar Nagar;Amethi;Amroha;Auraiya;Ayodhya;Azamgarh;Baghpat;Bahraich;Ballia;Balrampur;Banda;Barabanki;Bareilly;Basti;Bhadohi;Bijnor;Budaun;Bulandshahr;Chandauli;Chitrakoot;Deoria;Etah;Etawah;Farrukhabad;Fatehpur;Firozabad;Gautam Buddha Nagar;Ghaziabad;Ghazipur;Gonda;Gorakhpur;Hamirpur;Hapur;Hardoi;Hathras;Jalaun;Jaunpur;Jhansi;Kannauj;Kanpur Dehat;Kanpur Nagar;Kasganj;Kaushambi;Kheri;Kushi Nagar;Lalitpur;Lucknow;Maharajganj;Mahoba;Mainpuri;Mathura;Mau;Meerut;Mirzapur;Moradabad;Muzaffarnagar;Pilibhit;Pratapgarh;Prayagraj;Raebareli;Rampur;Saharanpur;Sambhal;Sant Kabeer Nagar;Shahjahanpur;Shamli;Shravasti;Siddharth Nagar;Sitapur;Sonbhadra;Sultanpur;Unnao;Varanasi
Uttarakhand|Almora;Bageshwar;Chamoli;Champawat;Dehradun;Haridwar;Nainital;Pauri Garhwal;Pithoragarh;Rudra Prayag;Tehri Garhwal;Udham Singh Nagar;Uttarkashi
West Bengal|24 Paraganas North;24 Paraganas South;Alipurduar;Bankura;Birbhum;Coochbehar;Darjeeling;Dinajpur Dakshin;Dinajpur Uttar;Hooghly;Howrah;Jalpaiguri;Jhargram;Kalimpong;Kolkata;Maldah;Medinipur East;Medinipur West;Murshidabad;Nadia;Paschim Bardhaman;Purba Bardhaman;Purulia
`.trim();

const sortValues = (values: Iterable<string>) =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right, "en-IN"));

export const INDIA_REGION_OPTIONS: Record<string, string[]> = Object.fromEntries(
  INDIA_REGION_DATA.split("\n").map((line) => {
    const [state, districts = ""] = line.split("|");
    return [state, sortValues(districts ? districts.split(";") : [])];
  }),
);

export const INDIA_STATE_OPTIONS = sortValues(Object.keys(INDIA_REGION_OPTIONS));

export const INDIA_PINCODE_REGEX = /^[1-9][0-9]{5}$/;

export const getDistrictOptionsForState = (state?: string | null) =>
  (state ? INDIA_REGION_OPTIONS[state] ?? [] : []);

export const isValidIndianState = (state?: string | null) =>
  Boolean(state && INDIA_REGION_OPTIONS[state]);

export const isValidDistrictForState = (state?: string | null, district?: string | null) =>
  Boolean(state && district && getDistrictOptionsForState(state).includes(district));

export const isValidIndianPincode = (value?: string | null) =>
  Boolean(value && INDIA_PINCODE_REGEX.test(value.trim()));
