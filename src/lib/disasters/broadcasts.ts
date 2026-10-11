export type BroadcastLink = { kind: string; name: string; url: string };

export type CountryBroadcast = {
  iso2: string;
  broadcast: string;
  broadcastUrl: string;
  links: BroadcastLink[];
  available?: string[];
  canAdd?: string[];
};

const COUNTRIES: CountryBroadcast[] = [
  {
    iso2: "CA",
    broadcast: "Alert Ready / National Public Alerting System",
    broadcastUrl: "https://www.alertready.ca/",
    available: ["ECCC warnings by province", "CWFIS wildfires", "Alert Ready", "Earthquakes Canada"],
    canAdd: ["SOPFEU Quebec fires", "BC Wildfire Service", "Ontario flood warnings", "Quebec vigilance"],
    links: [
      { kind: "alerts", name: "Environment Canada warnings", url: "https://weather.gc.ca/warnings/index_e.html" },
      { kind: "wildfire", name: "CWFIS interactive map", url: "https://cwfis.cfs.nrcan.gc.ca/interactive-map" },
      { kind: "wildfire", name: "CIFFC", url: "https://www.ciffc.ca/" },
      { kind: "flood", name: "ECCC water office", url: "https://wateroffice.ec.gc.ca/" },
      { kind: "province", name: "Quebec vigilance", url: "https://www.quebec.ca/securite-situations-urgence" },
      { kind: "province", name: "British Columbia Emergency", url: "https://www.emergencyinfobc.gov.bc.ca/" },
      { kind: "province", name: "Ontario alerts", url: "https://www.ontario.ca/page/emergency-alerts" },
      { kind: "quake", name: "Earthquakes Canada", url: "https://www.earthquakescanada.nrcan.gc.ca/" },
    ],
  },
  {
    iso2: "US",
    broadcast: "IPAWS / Wireless Emergency Alerts",
    broadcastUrl: "https://www.fema.gov/emergency-managers/practitioners/integrated-public-alert-warning-system",
    links: [
      { kind: "alerts", name: "NWS active alerts", url: "https://alerts.weather.gov/" },
      { kind: "wildfire", name: "NIFC", url: "https://www.nifc.gov/fire-information" },
      { kind: "flood", name: "USGS WaterWatch", url: "https://waterwatch.usgs.gov/" },
      { kind: "quake", name: "USGS", url: "https://earthquake.usgs.gov/earthquakes/map/" },
    ],
  },
  {
    iso2: "MX",
    broadcast: "SASMEX / CENAPRED",
    broadcastUrl: "https://www.gob.mx/cenapred",
    links: [
      { kind: "alerts", name: "CENAPRED", url: "https://www.gob.mx/cenapred" },
      { kind: "quake", name: "SSN UNAM", url: "http://www.ssn.unam.mx/" },
    ],
  },
  {
    iso2: "PA",
    broadcast: "SINAPROC",
    broadcastUrl: "https://www.sinaproc.gob.pa/",
    links: [
      { kind: "alerts", name: "SINAPROC", url: "https://www.sinaproc.gob.pa/" },
      { kind: "weather", name: "IMHPA", url: "https://www.imhpa.gob.pa/" },
      { kind: "quake", name: "USGS Panama", url: "https://earthquake.usgs.gov/earthquakes/map/" },
    ],
  },
  {
    iso2: "PE",
    broadcast: "SISMATE / INDECI",
    broadcastUrl: "https://www.gob.pe/indeci",
    links: [
      { kind: "alerts", name: "INDECI alerts", url: "https://www.gob.pe/institucion/indeci/tema/alertas" },
      { kind: "quake", name: "IGP", url: "https://www.igp.gob.pe/" },
    ],
  },
  {
    iso2: "RU",
    broadcast: "MChS EMERCOM",
    broadcastUrl: "https://en.mchs.gov.ru/",
    links: [{ kind: "alerts", name: "EMERCOM", url: "https://en.mchs.gov.ru/" }],
  },
  {
    iso2: "CN",
    broadcast: "No open public broadcast API. CEA page.",
    broadcastUrl: "https://www.cea.gov.cn/",
    links: [{ kind: "quake", name: "China Earthquake Administration", url: "https://www.cea.gov.cn/" }],
  },
  {
    iso2: "JP",
    broadcast: "J-Alert and JMA Earthquake Early Warning",
    broadcastUrl: "https://www.jma.go.jp/jma/indexe.html",
    links: [
      { kind: "alerts", name: "JMA warnings", url: "https://www.jma.go.jp/bosai/warning/" },
      { kind: "quake", name: "JMA map", url: "https://www.jma.go.jp/bosai/map.html" },
    ],
  },
  {
    iso2: "TH",
    broadcast: "NDWC / TMD",
    broadcastUrl: "https://www.ndwc.go.th/",
    links: [
      { kind: "alerts", name: "NDWC", url: "https://www.ndwc.go.th/" },
      { kind: "weather", name: "TMD", url: "https://www.tmd.go.th/" },
    ],
  },
  {
    iso2: "AU",
    broadcast: "AusAlert / Emergency Alert",
    broadcastUrl: "https://www.ausalert.gov.au/",
    links: [
      { kind: "alerts", name: "AusAlert", url: "https://www.ausalert.gov.au/" },
      { kind: "quake", name: "Geoscience Australia", url: "https://earthquakes.ga.gov.au/" },
      { kind: "weather", name: "BOM", url: "https://www.bom.gov.au/" },
    ],
  },
  {
    iso2: "NZ",
    broadcast: "Emergency Mobile Alert",
    broadcastUrl: "https://www.civildefence.govt.nz/",
    links: [
      { kind: "alerts", name: "Civil Defence", url: "https://www.civildefence.govt.nz/" },
      { kind: "quake", name: "GeoNet", url: "https://www.geonet.org.nz/" },
    ],
  },
  {
    iso2: "AQ",
    broadcast: "No national broadcast. COMNAP.",
    broadcastUrl: "https://www.comnap.aq/",
    links: [{ kind: "alerts", name: "COMNAP", url: "https://www.comnap.aq/" }],
  },
];

const CONTINENT: Record<string, CountryBroadcast> = {
  Africa: {
    iso2: "",
    broadcast: "No single continental broadcast. GDACS plus national agencies.",
    broadcastUrl: "https://www.gdacs.org/",
    links: [
      { kind: "alerts", name: "GDACS", url: "https://www.gdacs.org/" },
      { kind: "quake", name: "EMSC", url: "https://www.seismicportal.eu/" },
    ],
  },
  Europe: {
    iso2: "",
    broadcast: "EU Civil Protection plus national systems. Meteoalarm for weather.",
    broadcastUrl: "https://civil-protection-humanitarian-aid.ec.europa.eu/",
    links: [
      { kind: "alerts", name: "Meteoalarm", url: "https://www.meteoalarm.org/" },
      { kind: "alerts", name: "ERCC", url: "https://erccportal.jrc.ec.europa.eu/" },
      { kind: "quake", name: "EMSC", url: "https://www.seismicportal.eu/" },
    ],
  },
};

export function broadcastFor(iso2: string, continent: string): CountryBroadcast | null {
  return COUNTRIES.find((row) => row.iso2 === iso2) ?? CONTINENT[continent] ?? null;
}
