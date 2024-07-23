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
  getSammelbestellungDB,
  patchFristDB,
} from '../models/ProductsModel.js';

import fs from 'fs';
import path from 'path';
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_API_KEY);

const dirname = path.resolve();

let orderInformation = null; //Hier werden wichtige Informationen bzgl. Order gespeichert.

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

const deleteProduct = async (req, res) => {
  const { id } = req.params;

  const result = await deleteProductsDB(id);

  if (result) return res.status(200).send('Product wurde erfolgreich gelöscht');
  return res.status(400).send('Fehler beim Löschen des Products');
};

const setFrist = async (req, res) => {
  const { von, bis, status } = req.body;

  const result = await setFristDB(von, bis, status);

  if (result) return res.status(200).send('Frist wurde erfolgreich gesetzt');
  return res.status(400).send('Fehler beim setzen der Frist');
};

const getFrist = async (req, res) => {
  const result = await getFristDB();

  if (result) return res.status(200).json(result);
  return res.status(400).send('Internal Server Error');
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
  return res.status(400).send('Internal Server Error');
};

const login = async (req, res) => {
  const { email, password } = req.body;

  const result = await loginDB(email, password);

  if (result) return res.status(200).json(result);
  return res.status(400).send('Internal Server Error');
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
  const {
    name,
    artikelNummer,
    artikelNummerKempa,
    farbe,
    preis,
    groessen,
    imageSchicken,
    linkImage,
    category,
  } = req.body;

  const result = await postProductDB(
    name,
    artikelNummer,
    artikelNummerKempa,
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

  const { name, artikelNummer, artikelNummerKempa, farbe, preis, groessen, linkImage, category } =
    req.body;

  console.log(req.body);

  const result = await patchProductDB(
    name,
    artikelNummer,
    artikelNummerKempa,
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

const getSammelbestellung = async (req, res) => {
  const result = await getSammelbestellungDB();

  if (result) return res.status(200).json(result);
  return res.status(500).send('Internal Server Error');
};

const patchFrist = async (req, res) => {
  const { status, oldStatus } = req.body;

  console.log(status, ' ', oldStatus);

  const result = await patchFristDB(status, oldStatus);

  if (result) return res.status(200).json(result);
  return res.status(500).send('Internal Server Error');
};

const orderPay = async (req, res) => {
  console.log(req.body);
  // VORLAGE
  // line_items: [
  //   {
  //     price_data: {
  //       unit_amount: 5000,
  //       product_data: {
  //         name: 'T-shirt',
  //       },
  //       currency: 'eur',
  //     },
  //     quantity: 2,
  //   },
  // ],

  //Orderinformationen setzen
  orderInformation = req.body;

  const buyProductsList = [];
  //Stripe Produktliste für gekaufte Produkte zusammenstellen
  orderInformation.prods.forEach((produkt) => {
    //Item zusammenstellen
    buyProductsList.push({
      price_data: {
        unit_amount: produkt.price.includes('.')
          ? Number(produkt.price.replace('.', '').replace(',', ''))
          : Number(produkt.price.replace('.', '').replace(',', '')) * 100,
        product_data: {
          name: produkt.name,
        },
        currency: 'eur',
      },
      quantity: Number(produkt.anzahl),
    });
  });

  //AUFRUNDEN
  if (req.body.aufrundenValue) {
    const aufrundDifferenzwert = Number(orderInformation.aufrundenValue)
      .toFixed(2)
      .toString()
      .replace('.', '');

    buyProductsList.push({
      price_data: {
        unit_amount: Number(aufrundDifferenzwert),
        product_data: {
          name: 'Freiwilliges Aufrunden',
        },
        currency: 'eur',
      },
      quantity: 1,
    });
  }

  //Stripe-Checkout fertigstellen
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card', 'eps'],
    submit_type: 'pay',
    line_items: buyProductsList,
    mode: 'payment',
    success_url: `${
      process.env.SERVER_DEVMODE ? `http://localhost:${process.env.SERVER_PORT}` : `${req.baseUrl}`
    }/orderPaySuccess?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${
      process.env.SERVER_DEVMODE ? `http://localhost:${process.env.SERVER_PORT}` : `${req.baseUrl}`
    }/orderPayFailed?session_id={CHECKOUT_SESSION_ID}`,
    automatic_tax: { enabled: true },
  });

  //Stripe-Link ausgeben
  res.send(session.url);
};

const orderPaySuccess = async (req, res) => {
  console.log('Payment Success!!!');

  //Customer bekommen
  const session = await stripe.checkout.sessions.retrieve(req.query.session_id);

  if (session.status == 'complete') {
    console.log(orderInformation);

    //order in der Datenbank speichern & Bestellbestätigung per Mail senden
    const result = await postOrderDB(orderInformation);

    orderInformation = null; //Orderinformationen wieder löschen (Speicher freigeben)

    if (result) {
      //Orderinformationen wieder löschen (Speicher freigeben)
      return res.redirect(
        `${
          process.env.SERVER_DEVMODE
            ? `http://localhost:${process.env.SERVER_PORT}`
            : `${req.baseUrl}`
        }/#/orderconfirmation?confirmationType=Produktkauf`,
      );
    }

    //WENN FEHLER
    res
      .status(500)
      .send(
        'Fehler beim Speichern der Bestellung in der Datenbank aufgetreten (ProductsController -> paySuccess())',
      );
  } else {
    res.send('<h1>Leider ist beim Zahlen ein Fehler aufgetreten (paySuccess)</h1>');
  }
};

const orderPayFailed = async (req, res) => {
  orderInformation = null; //Orderinformationen wieder löschen (Speicher freigeben)
  console.log('Payment Failed!!!');
  res.redirect(
    `${
      process.env.SERVER_DEVMODE ? `http://localhost:${process.env.SERVER_PORT}` : `${req.baseUrl}`
    }/#/ordercancellation?confirmationType=Produktkauf`,
  );
};

const getOrders = async (req, res) => {
  const result = await getOrdersDB();

  if (result) return res.status(200).json(result);
  return res.status(400).send('Internal Server Error');
};

export {
  getProducts,
  getProduct,
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
  getSammelbestellung,
  patchFrist,
  orderPay,
  orderPaySuccess,
  orderPayFailed,
};
