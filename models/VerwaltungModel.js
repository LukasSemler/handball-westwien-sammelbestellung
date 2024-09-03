import { query, pool } from '../DB/index.js';
// import { insert_data } from '../../Scripts/convertExcelToJson.mjs';
import chalk from 'chalk';

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
    const personen = await query(`WITH person_mannschaften AS (
    SELECT 
        p.p_id,
        array_agg(DISTINCT m.name) AS mannschaften
    FROM 
        person p
    LEFT JOIN 
        public.person_mannschaft pm ON pm.person_fk = p.p_id
    LEFT JOIN 
        public.mannschaft m ON m.m_id = pm.mannschaft_fk 
    GROUP BY 
        p.p_id
),
person_rollen AS (
    SELECT 
        p.p_id,
        array_agg(DISTINCT r.name) AS rollen
    FROM 
        person p
    JOIN 
        public.person_rolle pr ON p.p_id = pr.p_fk
    JOIN 
        public.rolle r ON r.r_id = pr.r_fk
    GROUP BY 
        p.p_id
)
SELECT 
    p.*,
    a.street, 
    a.hausnummer, 
    a.plz, 
    a.ort,
    COALESCE(pm.mannschaften[1], null) as Mannschaftsname,
    COALESCE(mi.summe, null) as Mitgliederbeitragssumme, 
    COALESCE(mb.bezahlt, null) as MitgliederbeitragssummeBezahlt,
    p.newsletter as Newsletter,
    pr.rollen, 
    p.is_aktiv
FROM 
    person p
JOIN 
    public.adresse a ON a.a_id = p.adresse_fk
LEFT JOIN 
    public.mitgliedsbeitrag mb ON mb.m_id = p.mitgliedsbeitrag_fk
LEFT JOIN 
    public.mitgliedbeitrag_info mi ON mi.mi_id = mb.mitgliedsbeitrag_typ_fk
LEFT JOIN 
    person_mannschaften pm ON pm.p_id = p.p_id
LEFT JOIN 
    person_rollen pr ON pr.p_id = p.p_id
GROUP BY 
    p.p_id, a.street, a.hausnummer, a.plz, a.ort, pm.mannschaften, mi.summe, mb.bezahlt, pr.rollen
    ORDER BY p.nachname ASC;
`);
    return personen.rows;
  } catch (error) {
    console.log(error);
    return false;
  }
};

const getPersonDB = async (id) => {
  try {
    const personen = await query(
      `SELECT 
    p.*,
    a.street, 
    a.hausnummer, 
    a.plz, 
    a.ort,
    COALESCE(m.name, null) as Mannschaftsname,
    COALESCE(mi.summe, null) as Mitgliederbeitragssumme, 
    COALESCE(mb.bezahlt, null) as MitgliederbeitragssummeBezahlt,
    p.newsletter as Newsletter,
    array_agg(r.name) as Rollen, 
    p.is_aktiv
FROM 
    person p
JOIN 
    public.adresse a ON a.a_id = p.adresse_fk
LEFT JOIN 
    public.person_mannschaft pm ON pm.person_fk = p.p_id
LEFT JOIN 
    public.mannschaft m ON m.m_id = pm.mannschaft_fk 
LEFT JOIN 
    public.mitgliedsbeitrag mb ON mb.m_id = p.mitgliedsbeitrag_fk
LEFT JOIN 
    public.mitgliedbeitrag_info mi ON mi.mi_id = mb.mitgliedsbeitrag_typ_fk
JOIN 
    public.person_rolle pr ON p.p_id = pr.p_fk
JOIN 
    public.rolle r ON r.r_id = pr.r_fk
WHERE p.p_id = $1
GROUP BY 
    p.p_id, a.street, a.hausnummer, a.plz, a.ort, m.name, mi.summe, mb.bezahlt;`,
      [id],
    );
    return personen.rows[0];
  } catch (error) {
    console.log(error);
    return false;
  }
};

const patchPersonDB = async ({
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
  uww_nummer,
}) => {
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
    if (!roles[0]) throw new Error('Fehler bei adresseUpdated');

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
      '  update person set vorname = $1, nachname = $2, email = $3, telefonnummer = $4, newsletter = $5, status = $6, uww_nummer = $8 where p_id = $7 returning *; ',
      [vorname, nachname, email, telefonnummer, newsletter, status, p_id, uww_nummer],
    );

    if (!personUpdated[0]) throw new Error('Fehler bei PersonUpdated');

    // Update adress
    const { rows: adressUpdated } = await query.query(
      'UPDATE adresse SET street = $1, ort = $2, plz = $3 WHERE a_id = $4 RETURNING *',
      [street, ort, plz, person.rows[0].adresse_fk],
    );

    if (!adressUpdated[0]) throw new Error('Fehler bei adresseUpdated');

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
    return false;
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
  eintritt,
  newsletter,
  notizen,
  parents,
) => {
  const con = await pool.connect();
  try {
    //Start transaction
    await con.query('BEGIN');

    let parents_inserted = [];

    //-------------------------------------ADRESSE---------------------------------------------

    console.log(chalk.blue('INSERT address'));

    //Insert address
    const { rows: address } = await con.query(
      'INSERT INTO adresse (street, hausnummer, plz, ort) VALUES ($1, $2, $3, $4) RETURNING a_id;',
      [street, hausnummer, plz, ort],
    );

    if (!address[0]) {
      console.log(chalk.red('Error at address-INSERT'));
      throw new Error('Error at address-INSERT --> postPersonDB');
    }

    console.log(chalk.green('Address inserted'));

    //---------------------------------MITGLIEDSBEITRAG-------------------------------------------------

    let mitgliedsbeitrag_fk;

    //Insert into mitgliedsbeitrag if person is a player
    if (player_infos.mitgliederbeitragssumme && roles.includes('Spieler')) {
      console.log(chalk.blue('INSERT Mitgliedsbeitrag'));

      const { rows: m } = await con.query(
        'SELECT mi_id FROM mitgliedbeitrag_info WHERE summe = $1;',
        [player_infos.mitgliederbeitragssumme],
      );

      if (player_infos.mannschaft.mannschaftsname === 'Erste') {
        console.log(chalk.magenta('Erste Mannschaft -> keinen Beitrag'));

        const { rows: mitgliedsbeitrag } = await con.query(
          'INSERT INTO mitgliedsbeitrag (mitgliedsbeitrag_typ_fk, bezahlt) VALUES ($1, true) RETURNING m_id;',
          [3],
        );

        mitgliedsbeitrag_fk = mitgliedsbeitrag[0].m_id;
      } else if (m[0]) {
        console.log(chalk.magenta('Mitgliedsbeitrag gefunden -> normaler Beitrag'));

        const { rows: mitgliedsbeitrag } = await con.query(
          'INSERT INTO mitgliedsbeitrag (mitgliedsbeitrag_typ_fk, bezahlt) VALUES ($1, false) RETURNING m_id;',
          [m[0].mi_id],
        );

        if (!mitgliedsbeitrag[0]) {
          console.log(chalk.red('ERROR at Mitgliedsbeitrag-INSERT'));
          throw new Error('ERROR at Mitgliedsbeitrag-INSERT --> postPersonDB');
        }

        mitgliedsbeitrag_fk = mitgliedsbeitrag[0].m_id;
      } else {
        console.log(chalk.magenta('Mitgliedsbeitrag nicht gefunden -> eigener Beitrag'));

        const { rows: mitgliedsbeitrag } = await con.query(
          'INSERT INTO mitgliedsbeitrag (mitgliedsbeitrag_typ_fk, bezahlt) VALUES ($1, false) RETURNING m_id;',
          [4],
        );

        if (!mitgliedsbeitrag[0]) {
          console.log(chalk.red('ERROR at Mitgliedsbeitrag-INSERT'));
          throw new Error('ERROR at Mitgliedsbeitrag-INSERT --> postPersonDB');
        }

        mitgliedsbeitrag_fk = mitgliedsbeitrag[0].m_id;
      }

      console.log(chalk.green('Mitgliedsbeitrag inserted'));
    }

    //--------------------------------------MANNSCHAFT--------------------------------------------

    let mannschaft_fk;

    //get mannschaft_fk
    if (player_infos.mannschaft && roles.includes('Spieler')) {
      console.log(chalk.blue('GET Mannschaft'));

      const { rows: mannschaft } = await con.query('Select m_id from mannschaft where name = $1', [
        player_infos.mannschaft.mannschaftsname,
      ]);

      if (!mannschaft[0]) {
        console.log(chalk.red('ERROR at Mannschaft-INSERT'));
        throw new Error('ERROR at Mannschaft-INSERT --> postPersonDB');
      }

      console.log(chalk.green('Mannschaft inserted'));

      mannschaft_fk = mannschaft[0].m_id;
    }

    //--------------------------------------PERSON--------------------------------------------

    console.log(chalk.blue('INSERT person'));

    console.log(chalk.green(`Eintritt: ${eintritt ?? eintritt}`));

    //Insert person
    const { rows: person } = await con.query(
      `insert into person (vorname, nachname, email, telefonnummer, geburtsdatum, adresse_fk, newsletter, status,
       mitgliedsbeitrag_fk, eintrittsdatum) 
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *;`,
      [
        vorname,
        nachname,
        email ? email : '',
        telefonnummer,
        geburtsdatum ? geburtsdatum : null,
        address[0].a_id,
        newsletter,
        notizen,
        mitgliedsbeitrag_fk ? mitgliedsbeitrag_fk : null,
        eintritt ? eintritt : null,
      ],
    );

    if (!person[0]) {
      console.log(chalk.red('ERROR at Person-INSERT'));
      throw new Error('ERROR at Person-INSERT --> postPersonDB');
    }

    console.log(chalk.green('Person inserted'));

    //Insert roles
    for (const iterator of roles) {
      console.log(chalk.blue('INSERT Role'));

      //get role id
      const { rows: role } = await con.query('Select r_id from rolle where name = $1', [iterator]);

      if (!role[0]) {
        console.log(chalk.red('ERROR at Role-INSERT'));
        throw new Error('ERROR at Role-INSERT --> postPersonDB');
      }

      //Insert role
      await con.query('INSERT INTO person_rolle (p_fk, r_fk) VALUES ($1, $2)', [
        person[0].p_id,
        role[0].r_id,
      ]);

      console.log(chalk.green('Role inserted'));
    }

    //Insert parents if a player
    if (roles.includes('Spieler')) {
      console.log(chalk.blue('INSERT Parents'));

      if (parents) {
        //Check if person already exists
        for (const iterator of parents) {
          if (iterator.p_id) {
            console.log(chalk.bgYellow('Person already exists'));
            //Person already exists, link with player
            await con.query('INSERT INTO spieler_eltern (s_fk, e_fk) VALUES ($1, $2)', [
              person[0].p_id,
              iterator.p_id,
            ]);
          } else {
            console.log(chalk.bgYellow('Person does not exist'));
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

            parents_inserted.push(personParent[0]);
          }
        }
      } else {
        console.log(chalk.cyan('No parents'));
      }
    }

    //Link player with mannschaft
    if (roles.includes('Spieler')) {
      console.log(chalk.blue('INSERT Mannschaft'));
      await con.query('Insert into person_mannschaft (person_fk, mannschaft_fk) values ($1, $2);', [
        person[0].p_id,
        mannschaft_fk,
      ]);
      console.log(chalk.green('Person Mannschaft inserted'));

      //Link parents with mannschaft
      if (parents) {
        for (const iterator of parents_inserted) {
          console.log(iterator);

          await con.query(
            'Insert into person_mannschaft (person_fk, mannschaft_fk) values ($1, $2);',
            [iterator.p_id, mannschaft_fk],
          );
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
      `SELECT 
    p.*,
    a.street, 
    a.hausnummer, 
    a.plz, 
    a.ort,
    COALESCE(string_agg(DISTINCT m.name, ', '), 'No Mannschaft') as Mannschaftsname,
    COALESCE(mb.bezahlt, false) as MitgliederbeitragssummeBezahlt,
    p.newsletter as Newsletter,
    array_agg(DISTINCT r.name) as Rollen
FROM 
    person p
JOIN 
    public.adresse a ON a.a_id = p.adresse_fk
LEFT JOIN 
    public.person_mannschaft pm ON pm.person_fk = p.p_id
LEFT JOIN 
    public.mannschaft m ON m.m_id = pm.mannschaft_fk
LEFT JOIN 
    public.mitgliedsbeitrag mb ON mb.m_id = p.mitgliedsbeitrag_fk
JOIN 
    public.person_rolle pr ON p.p_id = pr.p_fk
JOIN 
    public.rolle r ON r.r_id = pr.r_fk
JOIN 
    public.spieler_eltern se ON p.p_id = se.e_fk 
WHERE 
    se.s_fk = $1
GROUP BY 
    p.p_id, a.street, a.hausnummer, a.plz, a.ort, mb.bezahlt;
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
    const { rows } = await query(`SELECT 
    p.*,
    a.street, 
    a.hausnummer, 
    a.plz, 
    a.ort,
    COALESCE(m.name, null) as Mannschaftsname,
    COALESCE(mi.summe, null) as Mitgliederbeitragssumme, 
    COALESCE(mb.bezahlt, null) as MitgliederbeitragssummeBezahlt,
    p.newsletter as Newsletter,
    array_agg(r.name) as Rollen, 
    p.is_aktiv
FROM 
    person p
JOIN 
    public.adresse a ON a.a_id = p.adresse_fk
LEFT JOIN 
    public.person_mannschaft pm ON pm.person_fk = p.p_id
LEFT JOIN 
    public.mannschaft m ON m.m_id = pm.mannschaft_fk 
LEFT JOIN 
    public.mitgliedsbeitrag mb ON mb.m_id = p.mitgliedsbeitrag_fk
LEFT JOIN 
    public.mitgliedbeitrag_info mi ON mi.mi_id = mb.mitgliedsbeitrag_typ_fk
JOIN 
    public.person_rolle pr ON p.p_id = pr.p_fk
JOIN 
    public.rolle r ON r.r_id = pr.r_fk
WHERE 
    r.name = 'Eltern'
GROUP BY 
    p.p_id, a.street, a.hausnummer, a.plz, a.ort, m.name, mi.summe, mb.bezahlt
   order by p.p_id asc;
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
    //! Obsolete
    // const { rows } = await query(
    //   'select p.* from person p where p.vorname = $1 and p.nachname = $2',
    //   [vorname, nachname],
    // );

    console.log(rows);

    if (!rows[0]) return false;

    let res_player = await getPersonDB(rows[0].p_id);
    if (!res_player) return false;

    let res_parents = await getParentsDB(rows[0].p_id);
    if (!res_parents) console.log('Spieler über 18Jahre, keine Eltern eingetragen');

    return { player: res_player, parents: res_parents ? res_parents : [] };
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

    //Check if person is already in DB
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

      //Eintrag in SpendeTbl
      const { rows: spendeRow } = await con.query(
        `INSERT INTO spenden (fk_p_id, summe, summeanzeigen, webseiteanzeigen, finanzamtmelden) VALUES ($1, $2, $3, $4, $5) RETURNING s_id;`,
        [
          personVorhanden[0].p_id,
          Number(spendenInformation.spendenwert.replace(',', '.')),
          spendenInformation.show_spendenwert,
          spendenInformation.show_on_web,
          spendenInformation.finanzamt,
        ],
      );

      await con.query('Update person set geburtsdatum = $1 where p_id = $2', [
        spendenInformation.geburtsdatum,
        personVorhanden[0].p_id,
      ]);

      if (!spendeRow[0]) {
        throw new Error('Fehler bei Spende-INSERT');
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

    //Eintrag in SpendeTbl
    const { rows: spendeRow } = await con.query(
      `INSERT INTO spenden (fk_p_id, summe, summeanzeigen, webseiteanzeigen, finanzamtmelden) VALUES ($1, $2, $3, $4, $5);`,
      [
        personRows[0].p_id,
        Number(spendenInformation.spendenwert),
        spendenInformation.show_spendenwert,
        spendenInformation.show_on_web,
        spendenInformation.finanzamt,
      ],
    );

    if (!spendeRow[0]) {
      throw new Error('Fehler bei Spende-INSERT');
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

      if (iterator.eltern.length > 0) {
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

      if (iterator.eltern.length > 0) {
        //link parents with player
        for (const player_id of player_ids) {
          for (const parent_id of parent_ids) {
            await connection.query('insert into spieler_eltern (s_fk, e_fk) values ($1, $2);', [
              player_id,
              parent_id,
            ]);
          }
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
  spielerName,
) => {
  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');

    //Check if person already exists
    const { rows: person } = await connection.query(
      'select p.* from person p where p.vorname = $1 and p.nachname = $2 and p.email = $3',
      [vorname, nachname, email],
    );

    if (person[0]) {
      console.log(chalk.blueBright('Person already exists'));

      //Person already exists, check if he already has the role Saisonkarte
      const { rows: rolle } = await connection.query(
        "select * from person_rolle pr where pr.r_fk = (select r.r_id from rolle r where r.name = 'Saisonkarte') and pr.p_fk = $1 ",
        [person[0].p_id],
      );

      if (!rolle[0]) {
        //Person already exists, set rolle to saisonkarte
        await connection.query(
          'insert into person_rolle (p_fk, r_fk) values ($1, (select r_id from rolle where name = $2));',
          [person[0].p_id, 'Saisonkarte'],
        );
      }

      //Insert into saisonkarte
      const { rows: saisonkarte } = await connection.query(
        'insert into saisonkarte (type, anzahl, summe, fk_p_id, spieler_name) values ($1, $2, $3, $4, $5) returning *;',
        [saisonkarten.title, Number(anzahl.name), summe, person[0].p_id, spielerName],
      );

      if (!saisonkarte[0]) {
        throw new Error('Fehler bei Saisonkarte-INSERT');
      }

      console.log('Saisonkarte erfolgreich eingetragen');
    } else {
      console.log(chalk.blueBright('Person does not exist'));

      //person does not exist
      await postPersonDB(
        strasse,
        hausnr,
        plz,
        ort,
        [],
        ['Saisonkarte'],
        vorname,
        nachname,
        email,
        telefonnummer,
        null,
        null,
        false,
        null,
        [],
      );

      //get person id
      const { rows: person } = await connection.query(
        'select p_id from person where vorname = $1 and nachname = $2 and email = $3;',
        [vorname, nachname, email],
      );

      if (!person[0]) {
        throw new Error('Fehler bei Person-SELECT');
      }

      //Insert into saisonkarte
      const { rows: saisonkarte } = await connection.query(
        'insert into saisonkarte (type, anzahl, summe, fk_p_id, spieler_name) values ($1, $2, $3, $4, $5) returning *;',
        [saisonkarten.title, Number(anzahl.name), summe, person[0].p_id, spielerName],
      );

      if (!saisonkarte[0]) {
        throw new Error('Fehler bei Saisonkarte-INSERT');
      }

      console.log('Person und Saisonkarte erfolgreich eingetragen');
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

const getVerteilerDB = async () => {
  try {
    const { rows } = await query(`SELECT 
    ev.v_id, 
    ev."name", 
    ev.selbst_erstellt, 
    ev.short, 
    ev.beschreibung, 
    COUNT(DISTINCT pr.p_fk) + 
    COUNT(DISTINCT CASE WHEN ev.selbst_erstellt = true THEN pe.p_fk END) AS num_people
FROM 
    email_verteiler ev
LEFT JOIN 
    rolle r ON ev.v_id = r.fk_email_verteiler
LEFT JOIN 
    person_rolle pr ON r.r_id = pr.r_fk
LEFT JOIN 
    person_email pe ON pe.v_fk = ev.v_id
GROUP BY 
    ev.v_id, ev."name", ev.selbst_erstellt, ev.short, ev.beschreibung;`);

    const { rows: newsletter } = await query(
      'select count(p.newsletter) as newsletter from person p;',
    );

    return { verteiler: rows, newsletter: newsletter[0].newsletter };
  } catch (error) {
    console.log(error);
    throw new Error('Fehler bei Verteiler-SELECT');
  }
};

const getMannschaftenDB = async () => {
  try {
    const { rows } = await query(`SELECT m.m_id as MannschaftID,
       m.name as Mannschaftsname,
       m.jahrgang as Jahrgang,
       COALESCE(COUNT(DISTINCT CASE WHEN r.name = 'Spieler' THEN p.p_id END), 0) as AnzahlSpieler,
       COALESCE(COUNT(DISTINCT CASE WHEN r.name = 'Eltern' THEN p.p_id END), 0) as AnzahlEltern
FROM public.mannschaft m
LEFT JOIN public.person_mannschaft pm ON m.m_id = pm.mannschaft_fk 
LEFT JOIN public.person p ON p.p_id = pm.person_fk 
LEFT JOIN public.person_rolle pr ON p.p_id = pr.p_fk
LEFT JOIN public.rolle r ON r.r_id = pr.r_fk
GROUP BY m.m_id, m.name, m.jahrgang
ORDER BY m.m_id ASC;`);

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
       mi.summe as Mitgliederbeitragssumme, 
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
join public.mitgliedbeitrag_info mi on mi.mi_id = mb.mitgliedsbeitrag_typ_fk
WHERE m.m_id = $1 
AND p.is_aktiv = true
AND EXISTS (
    SELECT 1
    FROM public.person_rolle pr2
    JOIN public.rolle r2 ON r2.r_id = pr2.r_fk
    WHERE pr2.p_fk = p.p_id
    AND r2.name = 'Spieler'
)
GROUP BY p.p_id, a.street, a.hausnummer, a.plz, a.ort, m.name, mi.summe, mb.bezahlt;`,
      [id],
    );

    if (spieler[0]) {
      result.spieler = spieler;
    }

    const { rows: eltern } = await query(
      `SELECT p.*,
       a.street, a.hausnummer, a.plz, a.ort,
       m.name as Mannschaftsname,

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
AND p.is_aktiv = true
AND EXISTS (
    SELECT 1
    FROM public.person_rolle pr2
    JOIN public.rolle r2 ON r2.r_id = pr2.r_fk
    WHERE pr2.p_fk = p.p_id
    AND r2.name = 'Eltern'
)
GROUP BY p.p_id, a.street, a.hausnummer, a.plz, a.ort, m.name, mb.bezahlt;`,
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

const postVerteilerDB = async (name, beschreibung, personen) => {
  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');

    //Insert into email_verteiler
    const { rows: emailVerteiler } = await connection.query(
      'INSERT INTO email_verteiler (name, beschreibung, short, selbst_erstellt) VALUES ($1, $2, $3, true) RETURNING v_id;',
      [name, beschreibung, name[0]],
    );

    if (!emailVerteiler[0]) {
      throw new Error('Fehler bei emailVerteiler-INSERT');
    }

    //Insert into person_email
    for (const person of personen) {
      await connection.query('INSERT INTO person_email (p_fk, v_fk) VALUES ($1, $2);', [
        person.p_id,
        emailVerteiler[0].v_id,
      ]);
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

const deleteVerteilerDB = async (id) => {
  try {
    await query('DELETE FROM email_verteiler WHERE v_id = $1;', [id]);
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
};

const patchVerteilerDB = async (id, personen) => {
  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');

    await connection.query('DELETE from person_email where v_fk = $1;', [id]);

    for (const person of personen) {
      await connection.query('INSERT INTO person_email (p_fk, v_fk) VALUES ($1, $2);', [
        person,
        id,
      ]);
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

const copyEmailsDB = async (id) => {
  try {
    const { rows } = await query(
      `SELECT DISTINCT
    p.email
FROM 
    email_verteiler ev
LEFT JOIN 
    rolle r ON ev.v_id = r.fk_email_verteiler
LEFT JOIN 
    person_rolle pr ON r.r_id = pr.r_fk
LEFT JOIN 
    person p ON pr.p_fk = p.p_id
LEFT JOIN 
    person_email pe ON pe.v_fk = ev.v_id
LEFT JOIN 
    person p2 ON pe.p_fk = p2.p_id
WHERE 
    ev.v_id = $1 
    AND p.is_aktiv = true
    AND (p.email IS NOT NULL OR p2.email IS NOT NULL)
UNION
SELECT DISTINCT   
    p2.email
FROM 
    email_verteiler ev
LEFT JOIN 
    person_email pe ON pe.v_fk = ev.v_id
LEFT JOIN 
    person p2 ON pe.p_fk = p2.p_id
WHERE 
    ev.v_id = $1
    AND p2.email IS NOT NULL;`,
      [id],
    );

    if (rows) return rows;
  } catch (error) {
    console.log(error);
    return false;
  }
};

const getOneVerteilerDB = async (id) => {
  try {
    const { rows } = await query(
      `   SELECT p.*,
       a.street, a.hausnummer, a.plz, a.ort,
       COALESCE(m.name, null) as Mannschaftsname,
       COALESCE(mi.summe, null) as Mitgliederbeitragssumme,
       COALESCE(mb.bezahlt, null) as MitgliederbeitragssummeBezahlt,
       p.newsletter as Newsletter,
       array_agg(r.name) as Rollen,
       p.is_aktiv
FROM person p
JOIN public.adresse a ON a.a_id = p.adresse_fk
LEFT JOIN public.person_mannschaft pm ON pm.person_fk = p.p_id
LEFT JOIN public.mannschaft m ON m.m_id = pm.mannschaft_fk
LEFT JOIN public.mitgliedsbeitrag mb ON mb.m_id = p.mitgliedsbeitrag_fk
    join public.mitgliedbeitrag_info mi on mi.mi_id = mb.mitgliedsbeitrag_typ_fk
JOIN public.person_rolle pr ON p.p_id = pr.p_fk
JOIN public.rolle r ON r.r_id = pr.r_fk
GROUP BY p.p_id, a.street, a.hausnummer, a.plz, a.ort, m.name, mi.summe, mb.bezahlt;
`,
      [id],
    );

    if (rows) return rows;
  } catch (error) {
    console.log(error);
    return false;
  }
};

const getSaisonkartenDB = async () => {
  try {
    const { rows } = await query(`select saisonkarte.s_id AS saisonkarte_id,
    saisonkarte."type" as "name",
    saisonkarte.summe,
    saisonkarte.bezahlt,
    saisonkarte.anzahl,
    saisonkarte.abgeholt,
    saisonkarte.spieler_name,
    person.p_id AS p_id,
    person.vorname,
    person.nachname,
    person.email,
    person.telefonnummer 
FROM
    saisonkarte
INNER JOIN
    person
ON
    saisonkarte.fk_p_id = person.p_id
    ORDER BY saisonkarte_id Asc;`);

    if (rows[0]) return rows;
  } catch (error) {
    console.log(error);
    return false;
  }
};

const patchSaisonkartenDB = async (id, bezahlt) => {
  try {
    await query('UPDATE saisonkarte SET bezahlt = $1 WHERE s_id = $2;', [bezahlt, id]);

    return true;
  } catch (error) {
    console.log('Error: ', error);
    return false;
  }
};

const patchSaisonkartenAbgeholtDB = async (id, abgeholt) => {
  try {
    await query('UPDATE saisonkarte SET abgeholt = $1 WHERE s_id = $2;', [abgeholt, id]);

    return true;
  } catch (error) {
    console.log('Error: ', error);
    return false;
  }
};

const getAllMitgliedsbeitragDB = async () => {
  try {
    const { rows } = await query(` SELECT
    p.*,
    m.*,
    ma.*
FROM
    person p
INNER JOIN
    mitgliedsbeitrag m
ON
    p.mitgliedsbeitrag_fk = m.m_id
LEFT JOIN
    person_mannschaft pm
ON
    p.p_id = pm.person_fk
LEFT JOIN
    mannschaft ma
ON
    pm.mannschaft_fk = ma.m_id
join public.mitgliedsbeitrag m2 on m2.m_id = p.mitgliedsbeitrag_fk
join public.mitgliedbeitrag_info mi on mi.mi_id = m2.mitgliedsbeitrag_typ_fk
   where mi.summe > 0 and p.is_aktiv = true;
`);

    if (rows[0]) return rows;
    return false;
  } catch (error) {
    console.log(error);
    return false;
  }
};

const mitgliedbeitragBezahltDB = async (id, bezahlt) => {
  try {
    await query('update mitgliedsbeitrag set bezahlt = $1 where m_id = $2;', [bezahlt, id]);

    return true;
  } catch (error) {
    console.log('Error: ', error);
    return false;
  }
};

const mitgliedbeitragStatsDB = async () => {
  try {
    const { rows } = await query(` WITH totals AS (
    SELECT
        COALESCE(SUM(mi.summe) FILTER (WHERE m.bezahlt = true), 0) AS total_amount_paid,
        COALESCE(SUM(mi.summe) FILTER (WHERE m.bezahlt = false), 0) AS total_amount_open,
        COALESCE(SUM(mi.summe), 0) AS total_amount,
        COUNT(*) AS total_fees,
        COUNT(*) FILTER (WHERE m.bezahlt = true) AS paid_fees,
        COUNT(*) FILTER (WHERE m.bezahlt = false) AS open_fees
    FROM
        mitgliedsbeitrag m
    JOIN public.mitgliedbeitrag_info mi on mi.mi_id = m.mitgliedsbeitrag_typ_fk
    JOIN public.mitgliedsbeitrag m2 on mi.mi_id = m2.mitgliedsbeitrag_typ_fk
)
SELECT
    total_amount_paid,
    total_amount_open,
    total_fees,
    paid_fees,
    open_fees,
    CASE
        WHEN total_amount = 0 THEN 0
        ELSE (total_amount_paid * 100.0 / total_amount)
    END AS percentage_paid
FROM
    totals;`);
    if (rows[0]) return rows;
    return false;
  } catch (error) {
    console.log(error);
    return false;
  }
};

const deactivatePersonDB = async (id, status) => {
  try {
    await query('update person set is_aktiv = $1 where p_id = $2;', [status, id]);

    if (!status) {
      await query(
        'insert into person_rolle (p_fk, r_fk) values ($1, (select r_id from rolle where name = $2));',
        [id, 'Deaktiviert'],
      );

      await query('delete from person_mannschaft where person_fk = $1;', [id]);
    } else {
      await query(
        'delete from person_rolle where p_fk = $1 and r_fk = (select r_id from rolle where name = $2);',
        [id, 'Deaktiviert'],
      );
    }

    return true;
  } catch (error) {
    console.log('Error: ', error);
    return false;
  }
};

const deletePersonDB = async (id) => {
  try {
    await query('delete from person where p_id = $1;', [id]);

    return true;
  } catch (error) {
    console.log('Error: ', error);
    return false;
  }
};

const mitgliedsbeitragSummeDB = async () => {
  try {
    const { rows } = await query('Select * from mitgliedbeitrag_info order by mi_id;');

    if (rows[0]) return rows;
  } catch (error) {
    console.log('Error: ', error);
    return false;
  }
};

const patch_mitgliedsbeitragSummeDB = async (summe_voll, summe_reduziert) => {
  try {
    await query('UPDATE mitgliedbeitrag_info SET summe = $1 WHERE mi_id = 1;', [summe_voll]);
    await query('UPDATE mitgliedbeitrag_info SET summe = $1 WHERE mi_id = 2;', [summe_reduziert]);

    return true;
  } catch (error) {
    console.log('Error: ', error);
    return false;
  }
};

const getUnassignedPlayersDB = async () => {
  try {
    const { rows } = await query(`SELECT p.*
FROM person p
LEFT JOIN person_mannschaft pm ON p.p_id = pm.person_fk 
LEFT JOIN person_rolle pr ON p.p_id = pr.p_fk 
LEFT JOIN rolle r ON pr.r_fk = r.r_id
WHERE pm.mannschaft_fk IS NULL AND is_aktiv = true
AND r.name IN ('Spieler');`);

    if (rows[0]) return rows;
    return [];
  } catch (error) {
    console.log(error);
    return false;
  }
};

const getUnassignedPlayersNumbersDB = async () => {
  try {
    const { rows } = await query(`SELECT COUNT(*)
FROM person p
LEFT JOIN person_mannschaft pm ON p.p_id = pm.person_fk 
LEFT JOIN person_rolle pr ON p.p_id = pr.p_fk 
LEFT JOIN rolle r ON pr.r_fk = r.r_id 
WHERE pm.mannschaft_fk IS NULL and is_aktiv = true
AND r.name IN ('Spieler');`);

    if (rows[0]) return rows;
    return false;
  } catch (error) {
    console.log(error);
    return false;
  }
};

const assignPlayerDB = async (id, mannschaft) => {
  const connection = await pool.connect();

  try {
    await connection.query('BEGIN');

    //get parents
    const { rows: parents } = await connection.query(
      'select p.* from person p join spieler_eltern se on p.p_id = se.e_fk where se.s_fk = $1',
      [id],
    );

    if (parents[0]) {
      console.log('Eltern wurden gefunden');

      for (const parent of parents) {
        //insert into person_mannschaft
        await connection.query(
          'insert into person_mannschaft (person_fk, mannschaft_fk) values ($1, $2);',
          [parent.p_id, mannschaft],
        );
      }
    }

    //insert into person_mannschaft
    await connection.query(
      'insert into person_mannschaft (person_fk, mannschaft_fk) values ($1, $2);',
      [id, mannschaft],
    );

    await connection.query('COMMIT');
    return true;
  } catch (error) {
    console.error(error);
    await connection.query('ROLLBACK');
    return false;
  }
};

const newsletterEmailsDB = async () => {
  try {
    const { rows } = await query(`SELECT p.email from person p where p.newsletter = true;`);
    if (rows[0]) return rows;

    return false;
  } catch (error) {
    console.log(error);
    return false;
  }
};

const postSpielerElternMannschaftNeuZuweisenDB = async () => {
  try {
    const { rows } = await query(`SELECT spielerNeuerMannschaftZuweisen`);
    if (rows[0]) return rows;

    return false;
  } catch (error) {
    console.log(error);
    return false;
  }
};

const getEinnahmenDB = async () => {
  try {
    const { rows: rowsSpenden } = await query('select sum(s.summe) as summen from spenden s');
    const { rows: rowsSaisonkarte } = await query(
      'select sum(s.summe) as summen from saisonkarte s',
    );
    const { rows: rowsOrder } = await query(
      `select sum(o.sum) as summen from "order" o where o.fk_s_id = (select max(s.s_id) from sammelbestellung s where s.status = 'over');`,
    );

    return [
      { type: 'Spenden', summe: rowsSpenden[0].summen },
      { type: 'Saisonkarten', summe: rowsSaisonkarte[0].summen },
      { type: 'Sammelbestellungen', summe: rowsOrder[0].summen },
    ];
  } catch (error) {
    console.log(error);
    return false;
  }
};

const getSpenderDB = async () => {
  try {
    const { rows } = await query(
      'select p.vorname, p.nachname, p.email, s.summe , s.summeanzeigen, s.webseiteanzeigen, s.finanzamtmelden, s.datum, p.geburtsdatum, a.street, a.hausnummer, a.plz, a.ort from person p join spenden s on s.fk_p_id = p.p_id join adresse a on a.a_id = p.adresse_fk',
    );

    if (rows[0]) return rows;
    return false;
  } catch (error) {
    console.log(error);
    return false;
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
  postVerteilerDB,
  deleteVerteilerDB,
  patchVerteilerDB,
  copyEmailsDB,
  getOneVerteilerDB,
  getSaisonkartenDB,
  patchSaisonkartenDB,
  patchSaisonkartenAbgeholtDB,
  getAllMitgliedsbeitragDB,
  mitgliedbeitragBezahltDB,
  mitgliedbeitragStatsDB,
  deactivatePersonDB,
  deletePersonDB,
  mitgliedsbeitragSummeDB,
  patch_mitgliedsbeitragSummeDB,
  getUnassignedPlayersDB,
  getUnassignedPlayersNumbersDB,
  assignPlayerDB,
  newsletterEmailsDB,
  postSpielerElternMannschaftNeuZuweisenDB,
  getEinnahmenDB,
  getSpenderDB,
};
