import express from 'express';
import path from 'path';
import morgan from 'morgan';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import forceHttps from 'express-force-https';
import { ErrorHandler, NotFoundHandler } from './middleware/index.js';

//Session
import cookieParser from 'cookie-parser';
import session from 'express-session';

//Dotenv.
import { config } from 'dotenv';
config();

//Routen
import customerRoutes from './routes/Router.js';

const PORT = process.env.SERVER_PORT || 5000;

const app = express();

app.use(forceHttps); //HEROKU ONLY: Redirect from http to https

app.set('trust proxy', 1);

app.use(morgan('dev'));
app.use(cors());
app.use(fileUpload());
app.use(cookieParser());

const dirname = path.resolve();

app.use(express.static(path.join(dirname, 'public')));
app.use(express.json()); // body parser
app.use(express.urlencoded({ extended: false }));

//Express-Sessions
app.use(
  session({
    name: 'WW-Sammelbestellung',
    secret: 'WW-Sammelbestellung',
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, //1Tag
  }),
);

//Normale Server-Routen
app.use('/', customerRoutes);

//Middleware-Routes
app.use(ErrorHandler); //Wenn ein Serverfehler vorhanden ist
app.use(NotFoundHandler); //Wenn die Route nicht gefunden wurde

app.listen(PORT, () => console.log(`Server running on port ${PORT}...`));

console.log('Server started');
