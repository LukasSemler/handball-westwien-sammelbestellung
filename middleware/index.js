//Dotenv.
import { config } from 'dotenv';
config();

//Postmark Email-Service
import postmark from 'postmark';
const emailClient = new postmark.ServerClient(process.env.postmarkToken);

export const ErrorHandler = (err, req, res, next) => {
  //Fehlermeldung-Consolenausgabe
  console.log(`---ERROR AM BACKENDSERVER---`);
  console.log(`${err}`);

  //Sicherheitsmaßnahme, damit keine Mails aufgrund Localhost versandt werden
  if (process.env.SERVER_DEVMODE === 'development')
    return res.status(500).send('Am Backend-Server ist ein Fehler aufgetreten');

  //Fehlermeldung-Emailbenachrichtigung
  const time = new Date();
  const error_time = `${time.getHours()}:${time.getMinutes()} - ${time.getDay()}.${time.getMonth()}.${time.getFullYear()}`;

  //Email senden
  try {
    const emailSendenResult = emailClient.sendEmailWithTemplate({
      From: 't.ruzek@handball-westwien.at',
      To: 'office@pixelia.at, lukas.semler@gmail.com',
      TemplateAlias: 'Backendserver-Error',
      TemplateModel: {
        error_zeit: error_time,
        error_messagetext: err.toString(),
      },
    });
  } catch {
    console.log(
      'Es konnte keine Fehlermail verschicken werden(FEHLER IN DER MIDDLEWARE) --> ErrorHandler',
    );
  }

  res.status(500).send('Am Backend-Server ist ein Fehler aufgetreten');
};

export const NotFoundHandler = (req, res, next) => {
  res.redirect('/');
};
