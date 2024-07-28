/* eslint-disable import/extensions */
import express, { Router } from 'express';
import asyncHandler from 'express-async-handler';
import {
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
} from '../controllers/ProductsController.js';

import {
  getRoles,
  postRoles,
  deleteRole,
  updateRole,
  getPersonen,
  getPerson,
  patchPerson,
  postPerson,
  getPersonStats,
  getParents,
  getAllParents,
  getMitgliedsbeitrag,
  spendePay,
  spendePaySuccess,
  spendePayFailed,
  importData,
  is_family,
  orderTicket,
  getVerteiler,
  getMannschaften,
  getMannschaft,
  postVerteiler,
  deleteVerteiler,
  copyEmails,
  getOneVerteiler,
  getSaisonkarten,
  patchSaisonkarten,
  patchSaisonkartenAbgeholt,
  getAllMitgliedsbeitrag,
  mitgliedbeitragBezahlt,
  mitgliedbeitragStats,
  patchVerteiler,
  saisonkartePaySuccess,
  saisonkartePayFailed,
} from '../controllers/VerwaltungController.js';

const router = express.Router();

router.get('/test', (req, res) => {
  console.log(req);

  return res.status(200).send('OK');
});

//*------Products------
router.get('/products', asyncHandler(getProducts));
router.get('/products/:id', asyncHandler(getProduct));
router.delete('/products/:id', asyncHandler(deleteProduct));
router.post('/productImage', asyncHandler(postProductImage));
router.post('/products', asyncHandler(postProduct));
router.patch('/products/:id', asyncHandler(patchProduct));

//*------Orders------
router.get('/orders', asyncHandler(getOrders));
router.post('/orderPay', orderPay);
router.get('/orderPaySuccess', orderPaySuccess);
router.get('/orderPayFailed', orderPayFailed);
router.get('/exportOrders', asyncHandler(exportOrders));

//*------Fristen------
router.post('/setFrist', asyncHandler(setFrist));
router.patch('/frist', asyncHandler(patchFrist));
router.get('/frist', asyncHandler(getFrist));

//*Spenden
router.post('/spendePay', spendePay);
router.get('/spendePaySuccess', spendePaySuccess);
router.get('/spendePayFailed', spendePayFailed);

router.post('/login', asyncHandler(login));

router.patch('/setBezahlt/:id', asyncHandler(setBezahlt));
router.patch('/setOffen/:id', asyncHandler(setOffen));

router.get('/getSammelbestellungen', asyncHandler(getSammelbestellung));

//--------------------------------------------
router.get('/getRoles', asyncHandler(getRoles));
router.post('/postRole', asyncHandler(postRoles));
router.delete('/deleteRole/:id', asyncHandler(deleteRole));
router.patch('/updateRole/:id', asyncHandler(updateRole));

router.get('/personen', asyncHandler(getPersonen));
router.get('/person/:id', asyncHandler(getPerson));
router.patch('/person/:id', asyncHandler(patchPerson));
router.post('/person', asyncHandler(postPerson));

router.get('/personStats', asyncHandler(getPersonStats));
router.get('/personParents/:id', asyncHandler(getParents));

router.get('/parents', asyncHandler(getAllParents));

router.get('/mitgliedsbeitrag', asyncHandler(getMitgliedsbeitrag));

router.get('/importData', asyncHandler(importData));

router.get('/family', asyncHandler(is_family));
router.post('/orderTicket', asyncHandler(orderTicket));

router.get('/verteiler', asyncHandler(getVerteiler));
router.get('/mannschaften', asyncHandler(getMannschaften));
router.get('/mannschaften/:id', asyncHandler(getMannschaft));
router.post('/postVerteiler', asyncHandler(postVerteiler));
router.delete('/deleteVerteiler/:id', asyncHandler(deleteVerteiler));
router.patch('/changeVerteiler/:id', asyncHandler(patchVerteiler));
router.get('/copyEmails/:id', asyncHandler(copyEmails));
router.get('/getVerteiler/:id', asyncHandler(getOneVerteiler));

router.get('/saisonkarten', asyncHandler(getSaisonkarten));
router.patch('/saisonkarten/:id', asyncHandler(patchSaisonkarten));
router.patch('/saisonkartenAbgeholt/:id', asyncHandler(patchSaisonkartenAbgeholt));
router.get('/SaisonkartePaySuccess', saisonkartePaySuccess);
router.get('/SaisonkartePayFailed', saisonkartePayFailed);

router.get('/mitgliedsbeitragAll', asyncHandler(getAllMitgliedsbeitrag));
router.post('/mitgliedsbeitragBezahlt/:id', asyncHandler(mitgliedbeitragBezahlt));
router.get('/mitgliedsbeitragStats', asyncHandler(mitgliedbeitragStats));
export default router;
