/* eslint-disable import/extensions */
import express from 'express';
import asyncHandler from 'express-async-handler';
import {
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
  getSammelbestellung,
  patchFrist,
} from '../controllers/ProductsController.js';

const router = express.Router();

router.get('/test', (req, res) => {
  return res.status(200).send('OK');
});

router.get('/products', asyncHandler(getProducts));
router.get('/products/:id', asyncHandler(getProduct));
router.delete('/products/:id', asyncHandler(deleteProduct));
router.post('/productImage', asyncHandler(postProductImage));
router.post('/products', asyncHandler(postProduct));
router.patch('/products/:id', asyncHandler(patchProduct));

router.post('/orders', asyncHandler(postOrder));
router.get('/orders', asyncHandler(getOrders));

router.post('/setFrist', asyncHandler(setFrist));
router.get('/frist', asyncHandler(getFrist));

router.get('/exportOrders', asyncHandler(exportOrders));

router.post('/login', asyncHandler(login));

router.patch('/setBezahlt/:id', asyncHandler(setBezahlt));
router.patch('/setOffen/:id', asyncHandler(setOffen));

router.get('/getSammelbestellungen', asyncHandler(getSammelbestellung));
router.patch('/frist', asyncHandler(patchFrist));
export default router;
