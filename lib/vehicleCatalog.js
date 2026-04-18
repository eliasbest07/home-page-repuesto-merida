export const BRANDS = [
  { id: 'toyota',     label: 'Toyota',     color: '#EB0A1E' },
  { id: 'ford',       label: 'Ford',       color: '#003DAD' },
  { id: 'chevrolet',  label: 'Chevrolet',  color: '#D4AF37' },
  { id: 'hyundai',    label: 'Hyundai',    color: '#002C5F' },
  { id: 'kia',        label: 'Kia',        color: '#BB162B' },
  { id: 'mitsubishi', label: 'Mitsubishi', color: '#E60012' },
  { id: 'nissan',     label: 'Nissan',     color: '#C3002F' },
  { id: 'jeep',       label: 'Jeep',       color: '#4A8600' },
]

export const CATALOG = {
  toyota: {
    years: [2018, 2019, 2020, 2021, 2022, 2023, 2024],
    models: {
      'Hilux':        { versions: ['SR', 'SR5', '4x4 TRD'] },
      'Land Cruiser': { versions: ['GX', 'VX', 'TXL'] },
      'Corolla':      { versions: ['Base', 'LE', 'XLE'] },
      'Fortuner':     { versions: ['Base', '4x4'] },
      'Yaris':        { versions: ['Base', 'S'] },
    },
  },
  ford: {
    years: [2018, 2019, 2020, 2021, 2022, 2023, 2024],
    models: {
      'F-150':     { versions: ['XL', 'XLT', 'Lariat', 'Raptor'] },
      'Explorer':  { versions: ['XLT', 'Limited', 'Platinum'] },
      'Ranger':    { versions: ['XL', 'XLT', 'Wildtrak'] },
      'EcoSport':  { versions: ['SE', 'Titanium'] },
      'Expedition':{ versions: ['XLT', 'Limited', 'King Ranch'] },
    },
  },
  chevrolet: {
    years: [2018, 2019, 2020, 2021, 2022, 2023, 2024],
    models: {
      'Silverado': { versions: ['WT', 'LT', 'LTZ', 'High Country'] },
      'Captiva':   { versions: ['LS', 'LT', 'LTZ'] },
      'Colorado':  { versions: ['WT', 'LT', 'Z71'] },
      'Aveo':      { versions: ['LS', 'LT'] },
      'Equinox':   { versions: ['LS', 'LT', 'Premier'] },
    },
  },
  hyundai: {
    years: [2018, 2019, 2020, 2021, 2022, 2023, 2024],
    models: {
      'Tucson':   { versions: ['GLS', 'GL', 'Limited'] },
      'Santa Fe': { versions: ['GLS', 'Limited'] },
      'Elantra':  { versions: ['GLS', 'SE', 'Sport'] },
      'i10':      { versions: ['Base', 'GL'] },
      'Creta':    { versions: ['Premium', 'Limited'] },
    },
  },
  kia: {
    years: [2018, 2019, 2020, 2021, 2022, 2023, 2024],
    models: {
      'Sportage': { versions: ['LX', 'EX', 'SX'] },
      'Sorento':  { versions: ['LX', 'EX', 'SX'] },
      'Rio':      { versions: ['LX', 'EX'] },
      'Picanto':  { versions: ['Base', 'EX'] },
      'Seltos':   { versions: ['LX', 'EX', 'SX'] },
    },
  },
  mitsubishi: {
    years: [2018, 2019, 2020, 2021, 2022, 2023, 2024],
    models: {
      'L200':      { versions: ['GL', 'GLS', 'Athlete'] },
      'Outlander': { versions: ['ES', 'SE', 'GT'] },
      'Montero':   { versions: ['Base', 'Sport', 'GLS'] },
      'ASX':       { versions: ['ES', 'SE'] },
      'Eclipse Cross': { versions: ['ES', 'SE', 'Limited'] },
    },
  },
  nissan: {
    years: [2018, 2019, 2020, 2021, 2022, 2023, 2024],
    models: {
      'Frontier':   { versions: ['S', 'SV', 'PRO-4X'] },
      'Pathfinder': { versions: ['S', 'SV', 'SL'] },
      'Sentra':     { versions: ['S', 'SV', 'SR'] },
      'Kicks':      { versions: ['S', 'SV', 'SR'] },
      'X-Trail':    { versions: ['Sense', 'Advance', 'Exclusive'] },
    },
  },
  jeep: {
    years: [2018, 2019, 2020, 2021, 2022, 2023, 2024],
    models: {
      'Grand Cherokee': { versions: ['Laredo', 'Limited', 'Overland'] },
      'Wrangler':       { versions: ['Sport', 'Sahara', 'Rubicon'] },
      'Compass':        { versions: ['Sport', 'Latitude', 'Limited'] },
      'Renegade':       { versions: ['Sport', 'Latitude', 'Trailhawk'] },
    },
  },
}
