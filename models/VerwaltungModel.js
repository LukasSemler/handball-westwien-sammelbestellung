import { query, pool } from '../DB/index.js';
import postmark from 'postmark';
// import { insert_data } from '../../Scripts/convertExcelToJson.mjs';

const emailToken = process.env.postmarkToken;
console.log(emailToken);
const emailClient = new postmark.ServerClient('313fee21-10d9-4d96-b3d4-75ea5a35ab20');

const getRolesDB = async (req, res) => {
  try {
    const roles = await query('SELECT * FROM rolle');
    return roles.rows;
  } catch (error) {
    return false;
  }
};

const postRolesDB = async (name, beschreibung) => {
  try {
    await query('INSERT INTO rolle (name, beschreibung) VALUES ($1, $2)', [name, beschreibung]);
    await query(
      'Insert into email_verteiler (name, beschreibung, short, selbst_erstellt) values ($1, $2, $3, false);',
      [name, beschreibung, name[0]],
    );
    return true;
  } catch (error) {
    return false;
  }
};

const deleteRoleDB = async (role_id) => {
  const connection = await pool.connect();

  try {
    await connection.query('BEGIN');

    await connection.query(
      'delete from email_verteiler ev where ev.name = (select r.name from rolle r where r.r_id = $1);',
      [role_id],
    );
    await connection.query('DELETE FROM rolle WHERE r_id = $1;', [role_id]);

    await connection.query('COMMIT');
    return true;
  } catch (error) {
    await connection.query('ROLLBACK');
    return false;
  } finally {
    await connection.release();
  }
};

const updateRoleDB = async (role_id, name, beschreibung) => {
  try {
    await query('UPDATE rolle SET name = $1, beschreibung = $2 WHERE r_id = $3', [
      name,
      beschreibung,
      role_id,
    ]);
    return true;
  } catch (error) {
    return false;
  }
};

// -------------------------------

const getPersonenDB = async () => {
  try {
    const personen = await query(`SELECT p.*,
       a.street, a.hausnummer, a.plz, a.ort,
       COALESCE(m.name, null) as Mannschaftsname,
       COALESCE(mb.summe, null) as Mitgliederbeitragssumme, 
       COALESCE(mb.bezahlt, null) as MitgliederbeitragssummeBezahlt,
       p.newsletter as Newsletter,
       array_agg(r.name) as Rollen
FROM person p
JOIN public.adresse a ON a.a_id = p.adresse_fk
LEFT JOIN public.person_mannschaft pm ON pm.person_fk = p.p_id
LEFT JOIN public.mannschaft m ON m.m_id = pm.mannschaft_fk 
LEFT JOIN public.mitgliedsbeitrag mb ON mb.m_id = p.mitgliedsbeitrag_fk
JOIN public.person_rolle pr ON p.p_id = pr.p_fk
JOIN public.rolle r ON r.r_id = pr.r_fk
GROUP BY p.p_id, a.street, a.hausnummer, a.plz, a.ort, m.name, mb.summe, mb.bezahlt;`);
    return personen.rows;
  } catch (error) {
    return false;
  }
};

const getPersonDB = async (id) => {
  try {
    const personen = await query(
      `SELECT p.*,
       a.street, a.hausnummer, a.plz, a.ort,
       COALESCE(m.name, null) as Mannschaftsname,
       COALESCE(mb.summe, null) as Mitgliederbeitragssumme, 
       COALESCE(mb.bezahlt, null) as MitgliederbeitragssummeBezahlt,
       p.newsletter as Newsletter,
       array_agg(r.name) as Rollen
FROM person p
JOIN public.adresse a ON a.a_id = p.adresse_fk
LEFT JOIN public.person_mannschaft pm ON pm.person_fk = p.p_id
LEFT JOIN public.mannschaft m ON m.m_id = pm.mannschaft_fk 
LEFT JOIN public.mitgliedsbeitrag mb ON mb.m_id = p.mitgliedsbeitrag_fk
JOIN public.person_rolle pr ON p.p_id = pr.p_fk
JOIN public.rolle r ON r.r_id = pr.r_fk
WHERE p.p_id = $1
GROUP BY p.p_id, a.street, a.hausnummer, a.plz, a.ort, m.name, mb.summe, mb.bezahlt;`,
      [id],
    );
    return personen.rows[0];
  } catch (error) {
    return false;
  }
};

const patchPersonDB = async (
  p_id,
  vorname,
  nachname,
  email,
  adresse_fk,
  mannschaft_fk,
  telefonnummer,
  mitgliedsbeitrag_fk,
  status,
  newsletter,
  street,
  hausnummer,
  plz,
  ort,
  mannschaftsname,
  mitgliederbeitragssumme,
  mitgliederbeitragssummebezahlt,
  rollen,
) => {
  const query = await pool.connect();
  try {
    //Start transaction
    await query.query('BEGIN');

    //Check if person exists
    const person = await query.query('SELECT * FROM person WHERE p_id = $1', [p_id]);

    //If person does not exist return false
    if (person.rows.length === 0) return false;

    //Check if Roles changed
    const { rows: roles } = await query.query(
      `SELECT r."name" 
FROM rolle r
INNER JOIN person_rolle pr ON r.r_id = pr.r_fk 
INNER JOIN person ON person.p_id = pr.p_fk 
WHERE person.p_id = $1;`,
      [p_id],
    );

    //Dont has a role -> not possible
    if (!roles[0]) {
      return false;
    }

    //Check if roles are the same
    let rolesChanged = false;
    if (roles.length === rollen.length) {
      roles.forEach((role) => {
        if (!rollen.includes(role.name)) {
          rolesChanged = true;
        }
      });
    } else {
      rolesChanged = true;
    }

    //Change Roles of the person
    if (rolesChanged) {
      //Delete all roles of the person
      await query.query('DELETE FROM person_rolle WHERE p_fk = $1', [p_id]);
      //Add new roles
      rollen.forEach(async (role) => {
        await query.query(
          `
  INSERT INTO person_rolle (p_fk, r_fk)
  SELECT $1, r_id
  FROM rolle
  WHERE name = $2`,
          [p_id, role],
        );
      });
    }

    //Update person exept for adress
    const { rows: personUpdated } = await query.query(
      '  update person set vorname = $1, nachname = $2, email = $3, telefonnummer = $4, newsletter = $5, status = $6 where p_id = $7 returning *; ',
      [vorname, nachname, email, telefonnummer, newsletter, status, p_id],
    );

    if (!personUpdated[0]) {
      return false;
    }

    //Person is a player, change mitgliedsbeitrag
    if (mitgliedsbeitrag_fk) {
      await query.query(
        `UPDATE mitgliedsbeitrag m
SET summe = $1,
    bezahlt = $2
WHERE m.m_id = (
    SELECT p.mitgliedsbeitrag_fk
    FROM person p
    WHERE p.p_id = $3
);
    `,
        [mitgliederbeitragssumme, mitgliederbeitragssummebezahlt, p_id],
      );
    }

    await query.query('COMMIT');
    await query.release();
    return true;
  } catch (error) {
    console.error(error);
    await query.query('ROLLBACK');
    await query.release();
  }
};

const postPersonDB = async (
  street,
  hausnummer,
  plz,
  ort,
  player_infos,
  roles,
  vorname,
  nachname,
  email,
  telefonnummer,
  geburtsdatum,
  newsletter,
  notizen,
  parents,
) => {
  const con = await pool.connect();
  try {
    //Start transaction
    await con.query('BEGIN');

    //Insert address
    const { rows: address } = await con.query(
      'INSERT INTO adresse (street, hausnummer, plz, ort) VALUES ($1, $2, $3, $4) RETURNING a_id;',
      [street, hausnummer, plz, ort],
    );

    if (!address[0]) {
      return false;
    }

    console.log(address[0].a_id);

    let mitgliedsbeitrag_fk;

    //Insert into mitgliedsbeitrag if person is a player
    if (player_infos.mitgliederbeitragssumme && roles.includes('Spieler')) {
      console.log('insert mitgliedsbeitrag');
      const { rows: mitgliedsbeitrag } = await con.query(
        'INSERT INTO mitgliedsbeitrag (summe, bezahlt) VALUES ($1, false) RETURNING m_id;',
        [player_infos.mitgliederbeitragssumme],
      );

      if (!mitgliedsbeitrag[0]) {
        return false;
      }

      mitgliedsbeitrag_fk = mitgliedsbeitrag[0].m_id;
    }

    console.log('mitgliedsbeitrag_fk: ', mitgliedsbeitrag_fk);

    let mannschaft_fk;

    //get mannschaft_fk
    if (player_infos.mannschaft && roles.includes('Spieler')) {
      const { rows: mannschaft } = await con.query('Select m_id from mannschaft where name = $1', [
        player_infos.mannschaft,
      ]);

      if (!mannschaft[0]) {
        return false;
      }

      mannschaft_fk = mannschaft[0].m_id;
    }

    console.log('mannschaft_fk: ', mannschaft_fk);

    //Insert person
    const { rows: person } = await con.query(
      `insert into person (vorname, nachname, email, telefonnummer, geburtsdatum, adresse_fk, newsletter, status, mitgliedsbeitrag_fk, eintrittsdatum) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *;`,
      [
        vorname,
        nachname,
        email ? email : '',
        telefonnummer,
        geburtsdatum,
        address[0].a_id,
        newsletter,
        notizen,
        mitgliedsbeitrag_fk ? mitgliedsbeitrag_fk : null,
        new Date(),
      ],
    );

    if (!person[0]) {
      return false;
    }

    if (roles.includes('Spieler')) {
      await con.query('Insert into person_mannschaft (person_fk, mannschaft_fk) values ($1, $2);', [
        person[0].p_id,
        mannschaft_fk,
      ]);
    }

    console.log('person: ', person[0]);

    //Insert roles
    for (const iterator of roles) {
      //get role id
      const { rows: role } = await con.query('Select r_id from rolle where name = $1', [iterator]);

      console.log('role: ', role[0]);

      if (!role[0]) {
        return false;
      }

      //Insert role
      await con.query('INSERT INTO person_rolle (p_fk, r_fk) VALUES ($1, $2)', [
        person[0].p_id,
        role[0].r_id,
      ]);
    }

    //Insert parents if a player
    if (roles.includes('Spieler')) {
      //Check if person already exists
      for (const iterator of parents) {
        if (iterator.p_id) {
          console.log('Person already exists');
          //Person already exists, link with player
          await con.query('INSERT INTO spieler_eltern (s_fk, e_fk) VALUES ($1, $2)', [
            person[0].p_id,
            iterator.p_id,
          ]);
        } else {
          console.log('Person does not exist');
          //person does not exist, create person
          //Insert address
          const { rows: address } = await con.query(
            'INSERT INTO adresse (street, hausnummer, plz, ort) VALUES ($1, $2, $3, $4) RETURNING a_id;',
            [iterator.street, iterator.houseNumber, iterator.postalCode, iterator.city],
          );

          if (!address[0]) {
            return false;
          }

          //Insert person
          const { rows: personParent } = await con.query(
            `insert into person (vorname, nachname, email, telefonnummer, geburtsdatum, adresse_fk, newsletter, status) values ($1, $2, $3, $4, $5, $6, $7, $8) returning *;`,
            [
              iterator.vorname,
              iterator.nachname,
              iterator.email ? iterator.email : '',
              iterator.telefonnummer,
              iterator.birthdate,
              address[0].a_id,
              iterator.newsletter,
              iterator.notes,
            ],
          );

          if (!personParent[0]) {
            return false;
          }

          //Insert roles
          for (const roleName of iterator.rollen) {
            //get role id
            const { rows: role } = await con.query('Select r_id from rolle where name = $1', [
              roleName,
            ]);

            if (!role[0]) {
              return false;
            }

            //Insert role
            await con.query('INSERT INTO person_rolle (p_fk, r_fk) VALUES ($1, $2)', [
              personParent[0].p_id,
              role[0].r_id,
            ]);
          }

          //Link player with parent
          await con.query('INSERT INTO spieler_eltern (s_fk, e_fk) VALUES ($1, $2)', [
            person[0].p_id,
            personParent[0].p_id,
          ]);
        }
      }
    }

    await con.query('COMMIT');
    return true;
  } catch (error) {
    await con.query('ROLLBACK');
    console.error(error);
    return false;
  } finally {
    await con.release();
  }
};

const getPersonStatsDB = async () => {
  try {
    const { rows } = await query(
      `SELECT 
    r.name AS RollenName,
    COUNT(pr.r_fk) AS RollenAnzahl
FROM 
    public.rolle r
JOIN 
    public.person_rolle pr ON r.r_id = pr.r_fk
GROUP BY 
    r.name
ORDER BY
    r.name ASC;`,
    );

    if (rows) {
      return rows;
    }
  } catch (error) {
    return false;
  }
};

const getParentsDB = async (id) => {
  try {
    const { rows } = await query(
      `SELECT p.*,
       a.street, a.hausnummer, a.plz, a.ort,
       COALESCE(m.name, 'No Mannschaft') as Mannschaftsname,
       COALESCE(mb.summe, 0) as Mitgliederbeitragssumme, 
       COALESCE(mb.bezahlt, false) as MitgliederbeitragssummeBezahlt,
       p.newsletter as Newsletter,
       array_agg(r.name) as Rollen
FROM person p
JOIN public.adresse a on a.a_id = p.adresse_fk
LEFT JOIN public.person_mannschaft pm ON pm.person_fk = p.p_id
LEFT JOIN public.mannschaft m ON m.m_id = pm.mannschaft_fk 
LEFT JOIN public.mitgliedsbeitrag mb on mb.m_id = p.mitgliedsbeitrag_fk
JOIN public.person_rolle pr on p.p_id = pr.p_fk
JOIN public.rolle r on r.r_id = pr.r_fk
join spieler_eltern se on p.p_id = se.e_fk where se.s_fk = $1 
GROUP BY p.p_id, a.street, a.hausnummer, a.plz, a.ort, m.name, mb.summe, mb.bezahlt;
`,
      [id],
    );

    if (rows[0]) {
      return rows;
    }
    return false;
  } catch (error) {
    console.log(error);
    return false;
  }
};

const getAllParentsDB = async () => {
  try {
    const { rows } = await query(`SELECT p.*,
       a.street, a.hausnummer, a.plz, a.ort,
       COALESCE(m.name, null) as Mannschaftsname,
       COALESCE(mb.summe, null) as Mitgliederbeitragssumme, 
       COALESCE(mb.bezahlt, null) as MitgliederbeitragssummeBezahlt,
       p.newsletter as Newsletter,
       array_agg(r.name) as Rollen
FROM person p
JOIN public.adresse a on a.a_id = p.adresse_fk
LEFT JOIN public.mannschaft m on m.m_id = p.mannschaft_fk
LEFT JOIN public.mitgliedsbeitrag mb on mb.m_id = p.mitgliedsbeitrag_fk
JOIN public.person_rolle pr on p.p_id = pr.p_fk
JOIN public.rolle r on r.r_id = pr.r_fk
WHERE p.p_id IN (
    SELECT p_fk
    FROM public.person_rolle
    WHERE r_fk = 1
)
GROUP BY p.p_id, a.street, a.hausnummer, a.plz, a.ort, m.name, mb.summe, mb.bezahlt;
`);

    if (rows) {
      return rows;
    }

    return false;
  } catch (error) {
    console.log(error);
    return false;
  }
};

const getMitgliedsbeitragDB = async (vorname, nachname, geburtsdatum) => {
  try {
    const { rows } = await query(
      'select p.* from person p where p.vorname = $1 and p.nachname = $2 and p.geburtsdatum = $3;',
      [vorname, nachname, geburtsdatum],
    );

    let res_player = await getPersonDB(rows[0].p_id);
    let res_parents = await getParentsDB(rows[0].p_id);

    if (res_player && res_parents) {
      return { player: res_player, parents: res_parents };
    }

    return false;
  } catch (error) {
    console.log('Error: ', error);
    return false;
  }
};

const postSpendeDB = async (spendenInformation) => {
  const con = await pool.connect();

  try {
    //Start transaction
    await con.query('BEGIN');

    //Insert address
    const { rows: personVorhanden } = await con.query(
      'SELECT p_id from person WHERE vorname = $1 AND nachname = $2;',
      [spendenInformation.vorname, spendenInformation.nachname],
    );

    //Wenn Person schon existiert
    if (personVorhanden[0]) {
      console.log('Person existiert schon');

      //Schauen ob Person Spender-Rolle hat
      const { rows: RolleSpender } = await con.query(
        `SELECT pr_id from person_rolle
          JOIN public.rolle r on r.r_id = person_rolle.r_fk
          WHERE p_fk = $1 AND r.name = 'Spender';`,
        [personVorhanden[0].p_id],
      );

      //Wenn person gefunden aber noch nicht die Spender-Role hat => NACHTRAGEN
      if (!RolleSpender[0]) {
        const { rows: RolleSpender } = await con.query(
          `INSERT INTO person_rolle (p_fk, r_fk) VALUES ($1, (SELECT r_id FROM rolle WHERE name = 'Spender')) RETURNING pr_id`,
          [personVorhanden[0].p_id],
        );

        if (!RolleSpender[0]) {
          throw new Error('Fehler bei nachtragen der Rolle Spender');
        }
      }

      //Status ausgeben
      await con.query('COMMIT');
      return true;
    }

    //Spender eintragen
    const { rows: adresseRows } = await con.query(
      'INSERT INTO adresse (street, hausnummer, plz, ort) VALUES ($1, $2, $3 ,$4) RETURNING a_id;',
      [
        spendenInformation.strasse,
        spendenInformation.hausnr,
        spendenInformation.plz,
        spendenInformation.ort,
      ],
    );

    if (!adresseRows[0]) {
      throw new Error('Fehler bei Adresse-INSERT');
    }

    const { rows: personRows } = await con.query(
      `INSERT INTO person (vorname, nachname, email, geburtsdatum, adresse_fk, mannschaft_fk, eintrittsdatum, telefonnummer, uww_nummer, mitgliedsbeitrag_fk, status, newsletter) 
      VALUES ($1, $2, $3, $4, $5, null, now(), $6, null, null, null, true) RETURNING p_id;`,
      [
        spendenInformation.vorname,
        spendenInformation.nachname,
        spendenInformation.email,
        spendenInformation.geburtsdatum,
        adresseRows[0].a_id,
        spendenInformation.telefonnummer,
      ],
    );

    if (!personRows[0]) {
      throw new Error('Fehler bei Person-INSERT');
    }

    const { rows: personRolle } = await con.query(
      `INSERT INTO person_rolle (p_fk, r_fk) VALUES ($1, (SELECT r_id FROM rolle WHERE name = 'Spender')) RETURNING pr_id;`,
      [personRows[0].p_id],
    );

    if (!personRolle[0]) {
      throw new Error('Fehler bei PersonenRolle-INSERT');
    }

    //* Wenn alles gepasst hat
    await con.query('COMMIT');

    //Status ausgeben
    return true;
  } catch (error) {
    //Wenn Fehler
    await con.query('ROLLBACK');
    console.error(error);
    //Status ausgeben
    return false;
  } finally {
    //DB-Verbindung wieder schließen
    await con.release();
  }
};

const importDataDB = async () => {
  const connection = await pool.connect();
  try {
    connection.query('BEGIN');

    for (const iterator of insert_data) {
      const parent_ids = [];
      const player_ids = [];
      let mannschaft_id;

      console.log(iterator);

      //insert parents
      for (const parent of iterator.eltern) {
        //console.log('Parent ', parent);
        const { rows: adress } = await connection.query(
          'insert into adresse (street, plz, ort) values ($1, $2, $3) returning *;',
          [parent.strasse, parent.plz, parent.ort],
        );

        if (!adress[0]) {
          throw new Error('Fehler bei Adresse-INSERT');
        }

        const { rows: personRows } = await connection.query(
          `INSERT INTO person (vorname, nachname, email, adresse_fk, telefonnummer)
      VALUES ($1, $2, $3, $4, $5) RETURNING p_id;`,
          [
            parent.name.split(' ')[0],
            parent.name.split(' ')[1],
            parent.email,
            adress[0].a_id,
            parent.telefonnummer,
          ],
        );

        if (!personRows[0]) {
          throw new Error('Fehler bei Person-INSERT');
        }

        //Rolle Eltern hinzufuegen
        await connection.query('insert into person_rolle (p_fk, r_fk) values ($1, 1);', [
          personRows[0].p_id,
        ]);

        parent_ids.push(personRows[0].p_id);
      }

      //insert player
      for (const player of iterator.children) {
        //console.log('Player ', player);
        //insert address
        const { rows: adress } = await connection.query(
          'insert into adresse (street, plz, ort) values ($1, $2, $3) returning *;',
          [player.strasse, player.plz, player.ort],
        );

        if (!adress[0]) {
          throw new Error('Fehler bei Adresse-INSERT');
        }

        //get mannschaft ID
        const { rows: mannschaft } = await connection.query(
          'select m_id from mannschaft where name = $1;',
          [player.kader],
        );

        if (!mannschaft[0]) {
          throw new Error('Fehler bei Mannschaft-SELECT');
        }

        mannschaft_id = mannschaft[0].m_id;

        //insert into mitgliedsbeitrag
        const { rows: mitgliedsbeitrag } = await connection.query(
          'insert into mitgliedsbeitrag (summe, bezahlt) values ($1, false) returning *;',
          [player.beitrag],
        );

        if (!mitgliedsbeitrag[0]) {
          throw new Error('Fehler bei Mitgliedsbeitrag-INSERT');
        }

        //insert person
        const { rows: personRows } = await connection.query(
          `INSERT INTO person (vorname, nachname, email, adresse_fk, telefonnummer, geburtsdatum, eintrittsdatum, uww_nummer, mitgliedsbeitrag_fk)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING p_id;`,
          [
            player.vorname,
            player.name,
            player.email,
            adress[0].a_id,
            player.telefonnummer,
            player.geb,
            player.eintritt,
            player.uwwNr,
            mitgliedsbeitrag[0].m_id,
          ],
        );

        if (!personRows[0]) {
          throw new Error('Fehler bei Person-INSERT');
        }

        //Rolle Eltern hinzufuegen
        await connection.query('insert into person_rolle (p_fk, r_fk) values ($1, 2);', [
          personRows[0].p_id,
        ]);

        player_ids.push(personRows[0].p_id);

        //Spieler und eltern zur Mannschaft hinzufuegen
        await connection.query(
          'insert into person_mannschaft (person_fk, mannschaft_fk) values ($1, $2);',
          [personRows[0].p_id, mannschaft[0].m_id],
        );

        for (const parent_id of parent_ids) {
          await connection.query(
            'insert into person_mannschaft (person_fk, mannschaft_fk) values ($1, $2);',
            [parent_id, mannschaft[0].m_id],
          );
        }
      }

      //link parents with player
      for (const player_id of player_ids) {
        for (const parent_id of parent_ids) {
          await connection.query('insert into spieler_eltern (s_fk, e_fk) values ($1, $2);', [
            player_id,
            parent_id,
          ]);
        }
      }

      console.log('Eintrag erfolgreich');
      console.log('===================================');
    }

    await connection.query('COMMIT');
    return true;
  } catch (error) {
    console.error(error);
    await connection.query('ROLLBACK');

    return false;
  } finally {
    await connection.release();
  }
};

const orderTicketDB = async (
  vorname,
  nachname,
  email,
  telefonnummer,
  strasse,
  hausnr,
  plz,
  ort,
  geburtsdatum,
  saisonkarten,
  anzahl,
  summe,
) => {
  const connection = await pool.connect();
  try {
    //add person to the db
    const { rows } = await connection.query(``, []);
  } catch (error) {
  } finally {
  }
};

const getVerteilerDB = async () => {
  try {
    const { rows } =
      await query(`SELECT ev.v_id, ev."name", ev.selbst_erstellt, ev.short, ev.beschreibung, COUNT(DISTINCT pr.p_fk) AS num_people
FROM email_verteiler ev
LEFT JOIN rolle r ON ev.v_id = r.fk_email_verteiler
LEFT JOIN person_rolle pr ON r.r_id = pr.r_fk
GROUP BY ev.v_id, ev."name";`);

    if (rows[0]) return rows;
    return false;
  } catch (error) {
    console.log(error);
    throw new Error('Fehler bei Verteiler-SELECT');
  }
};

const getMannschaftenDB = async () => {
  try {
    const { rows } = await query(`SELECT m.m_id as MannschaftID,
       m.name as Mannschaftsname,
       COUNT(DISTINCT CASE WHEN r.name = 'Spieler' THEN p.p_id END) as AnzahlSpieler,
       COUNT(DISTINCT CASE WHEN r.name = 'Eltern' THEN p.p_id END) as AnzahlEltern
FROM public.mannschaft m
JOIN public.person_mannschaft pm ON m.m_id = pm.mannschaft_fk 
JOIN public.person p ON p.p_id = pm.person_fk 
JOIN public.person_rolle pr ON p.p_id = pr.p_fk
JOIN public.rolle r ON r.r_id = pr.r_fk
GROUP BY m.m_id, m.name;`);

    if (rows[0]) return rows;
    return false;
  } catch (error) {
    console.log(error);
    throw new Error('Fehler bei Mannschaften-SELECT');
  }
};

const getMannschaftDB = async (id) => {
  try {
    let result = {};

    const { rows: spieler } = await query(
      `SELECT p.*,
       a.street, a.hausnummer, a.plz, a.ort,
       m.name as Mannschaftsname,
       mb.summe as Mitgliederbeitragssumme, 
       mb.bezahlt as MitgliederbeitragssummeBezahlt,
       p.newsletter as Newsletter,
       array_agg(r.name) as Rollen
FROM person p
JOIN public.adresse a ON a.a_id = p.adresse_fk
JOIN public.person_mannschaft pm ON pm.person_fk = p.p_id
JOIN public.mannschaft m ON m.m_id = pm.mannschaft_fk 
LEFT JOIN public.mitgliedsbeitrag mb ON mb.m_id = p.mitgliedsbeitrag_fk
JOIN public.person_rolle pr ON p.p_id = pr.p_fk
JOIN public.rolle r ON r.r_id = pr.r_fk
WHERE m.m_id = $1
AND EXISTS (
    SELECT 1
    FROM public.person_rolle pr2
    JOIN public.rolle r2 ON r2.r_id = pr2.r_fk
    WHERE pr2.p_fk = p.p_id
    AND r2.name = 'Spieler'
)
GROUP BY p.p_id, a.street, a.hausnummer, a.plz, a.ort, m.name, mb.summe, mb.bezahlt;`,
      [id],
    );

    if (spieler[0]) {
      result.spieler = spieler;
    }

    const { rows: eltern } = await query(
      `SELECT p.*,
       a.street, a.hausnummer, a.plz, a.ort,
       m.name as Mannschaftsname,
       mb.summe as Mitgliederbeitragssumme, 
       mb.bezahlt as MitgliederbeitragssummeBezahlt,
       p.newsletter as Newsletter,
       array_agg(r.name) as Rollen
FROM person p
JOIN public.adresse a ON a.a_id = p.adresse_fk
JOIN public.person_mannschaft pm ON pm.person_fk = p.p_id
JOIN public.mannschaft m ON m.m_id = pm.mannschaft_fk 
LEFT JOIN public.mitgliedsbeitrag mb ON mb.m_id = p.mitgliedsbeitrag_fk
JOIN public.person_rolle pr ON p.p_id = pr.p_fk
JOIN public.rolle r ON r.r_id = pr.r_fk
WHERE m.m_id = $1 
AND EXISTS (
    SELECT 1
    FROM public.person_rolle pr2
    JOIN public.rolle r2 ON r2.r_id = pr2.r_fk
    WHERE pr2.p_fk = p.p_id
    AND r2.name = 'Eltern'
)
GROUP BY p.p_id, a.street, a.hausnummer, a.plz, a.ort, m.name, mb.summe, mb.bezahlt;`,
      [id],
    );

    if (eltern[0]) {
      result.eltern = eltern;
    }

    return result;
  } catch (error) {
    console.log('Error: ', error);
    throw new Error('Fehler bei Mannschaft-SELECT');
  }
};

export {
  getRolesDB,
  postRolesDB,
  deleteRoleDB,
  updateRoleDB,
  getPersonenDB,
  getPersonDB,
  patchPersonDB,
  postPersonDB,
  getPersonStatsDB,
  getParentsDB,
  getAllParentsDB,
  getMitgliedsbeitragDB,
  postSpendeDB,
  importDataDB,
  orderTicketDB,
  getVerteilerDB,
  getMannschaftenDB,
  getMannschaftDB,
};
