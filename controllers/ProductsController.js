import {
  getProductsDB,
  getProductDB,
  postOrderDB,
  getOrdersDB,
  deleteProductsDB,
  setFristDB,
  getFristDB,
  exportOrdersDB,
  loginDB,
  postProductDB,
  patchProductDB,
  setBezahltDB,
  setOffenDB,
} from '../models/ProductsModel.js';

import fs from 'fs';
import path from 'path';

const dirname = path.resolve();

const getProducts = async (req, res) => {
  const result = await getProductsDB();

  if (result) return res.status(200).json(result);
  return res.status(500).send('Internal Server Error');
};

const getProduct = async (req, res) => {
  const { id } = req.params;
  const result = await getProductDB(id);

  if (result) return res.status(200).json(result);
  return res.status(500).send('Internal Server Error');
};

const postOrder = async (req, res) => {
  const daten = req.body;
  console.log(daten);

  const result = await postOrderDB(daten);

  if (result) return res.status(200).json(result);
  return res.status(500).send('Error');
};

const getOrders = async (req, res) => {
  const result = await getOrdersDB();

  if (result) return res.status(200).json(result);
  return res.status(500).send('Internal Server Error');
};

const deleteProduct = async (req, res) => {
  const { id } = req.params;

  const result = await deleteProductsDB(id);

  if (result) return res.status(200).send('Product wurde erfolgreich gelöscht');
  return res.status(500).send('Fehler beim Löschen des Products');
};

const setFrist = async (req, res) => {
  const { zeitpunkt } = req.body;

  const result = await setFristDB(zeitpunkt);

  if (result) return res.status(200).send('Frist wurde erfolgreich gesetzt');
  return res.status(500).send('Fehler beim setzen der Frist');
};

const getFrist = async (req, res) => {
  const result = await getFristDB();

  if (result) return res.status(200).json(result);
  return res.status(500).send('Internal Server Error');
};

const exportOrders = async (req, res) => {
  const { von, bis } = req.query;
  console.log(von, bis);

  let result;

  //leer
  if (von == 'null' && bis == 'null') {
    console.log('IF');
    result = await exportOrdersDB(null, null);
  }
  // Von bis leer
  else if (von && bis == 'null') {
    const vonJS = new Date(von);
    const vonPSQL = vonJS.toISOString().slice(0, 19).replace('T', ' ');

    const bisJS = new Date();
    const bisPSQL = bisJS.toISOString().slice(0, 19).replace('T', ' ');

    result = await exportOrdersDB(vonPSQL, bisPSQL);
  }
  //leer bis
  else if (von == 'null' && bis) {
    const bisJS = new Date(bis);
    const bisPSQL = bisJS.toISOString().slice(0, 19).replace('T', ' ');

    result = await exportOrdersDB(null, bisPSQL);
  }
  //alles
  else {
    const vonJS = new Date(von);
    const vonPSQL = vonJS.toISOString().slice(0, 19).replace('T', ' ');

    const bisJS = new Date(bis);
    const bisPSQL = bisJS.toISOString().slice(0, 19).replace('T', ' ');

    result = await exportOrdersDB(vonPSQL, bisPSQL);
  }

  if (result) return res.status(200).json(result);
  return res.status(500).send('Internal Server Error');
};

const login = async (req, res) => {
  const { email, password } = req.body;

  const result = await loginDB(email, password);

  if (result) return res.status(200).json(result);
  return res.status(500).send('Internal Server Error');
};

const postProductImage = async (req, res) => {
  try {
    const { titel, datentyp } = req.body;

    console.log('Titel: ' + titel, '| Datentyp: ' + datentyp);

    const uniqueImageName = path.join(dirname, `public/images/${titel}.${datentyp}`);
    //schauen ob das Bild schon existiert, wenn ja löschen und neu erstellen
    if (fs.existsSync(`${dirname}/public/images/${titel}.${datentyp}`)) {
      fs.unlinkSync(`${dirname}/public/images/${titel}.${datentyp}`);
    }

    fs.writeFileSync(`${uniqueImageName}`, req.files.image.data);

    res.status(200).send('Success');
  } catch (error) {
    console.log(error);
    res.status(400).send('Something went wrong');
  }
};

const postProduct = async (req, res) => {
  const { name, artikelNummer, farbe, preis, groessen, imageSchicken, linkImage, category } =
    req.body;

  const result = await postProductDB(
    name,
    artikelNummer,
    farbe,
    preis,
    groessen,
    imageSchicken,
    linkImage,
    category,
  );

  if (result) return res.status(200).json(result);
  return res.status(500).send('Internal Server Error');
};

const patchProduct = async (req, res) => {
  const { id } = req.params;

  const { name, artikelNummer, farbe, preis, groessen, linkImage, category } = req.body;

  console.log(req.body);

  const result = await patchProductDB(
    name,
    artikelNummer,
    farbe,
    preis,
    groessen,
    linkImage,
    category,
    id,
  );

  if (result) return res.status(200).send('Success');
  return res.status(500).send('Internal Server Error');
};

const setBezahlt = async (req, res) => {
  const { id } = req.params;

  const result = await setBezahltDB(id);

  if (result) return res.status(200).json(result);
  return res.status(500).send('Internal Server Error');
};

const setOffen = async (req, res) => {
  const { id } = req.params;

  const result = await setOffenDB(id);

  if (result) return res.status(200).json(result);
  return res.status(500).send('Internal Server Error');
};

export {
  getProducts,
  getProduct,
  postOrder,
  getOrders,
  deleteProduct,
  setFrist,
  getFrist,
  exportOrders,
  login,
  postProductImage,
  postProduct,
  patchProduct,
  setBezahlt,
  setOffen,
};
