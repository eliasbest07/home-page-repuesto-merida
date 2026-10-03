// Pruebas de las reglas de este repo contra los emuladores (npm test aquí).
// Cada escritura copia los campos EXACTOS que manda la app (lib/helpers/*.dart del repo de la app).
import { test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

// Las reglas se leen del repo (un nivel arriba): las mismas que se despliegan.
const regla = (archivo) => readFileSync(new URL('../' + archivo, import.meta.url), 'utf8');
const TS = () => firebase.firestore.FieldValue.serverTimestamp();
const URL_BASE =
  'https://firebasestorage.googleapis.com/v0/b/repuestos-merida.appspot.com/o/';

let env;
const T1 = 'tallerUno', C1 = 'clienteUno', C2 = 'clienteDos', X = 'extrano';
const db = (uid) => env.authenticatedContext(uid).firestore();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-reglas',
    firestore: { rules: regla('firestore.rules'), host: '127.0.0.1', port: 8181 },
    storage: { rules: regla('storage.rules'), host: '127.0.0.1', port: 9199 },
    database: { rules: regla('database.rules.json'), host: '127.0.0.1', port: 9001 },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const a = ctx.firestore();
    // Anuncio ya aprobado por el oso.
    await a.doc(`servicios_proveedores/${T1}_taller`).set({
      tipo: 'taller', nombre: 'Taller Uno', responsable: 'Pedro',
      descripcion: '', ciudad: 'Mérida', zona: '', horario: '',
      ubicacion: { lat: 8.59, lng: -71.14 }, a_domicilio: false,
      foto: '', portada: '', fotos: [], owner_uids: [T1],
      activo: true, verificado: true, pausado: false, estado: 'aprobado',
    });
    // Anuncio rechazado, para la corrección.
    await a.doc(`servicios_proveedores/${T1}_llaves`).set({
      tipo: 'llaves', nombre: 'Llaves Uno', responsable: 'Pedro',
      descripcion: '', ciudad: 'Mérida', zona: '', horario: '',
      ubicacion: { lat: 8.59, lng: -71.14 }, a_domicilio: false,
      foto: '', portada: '', fotos: [], owner_uids: [T1],
      activo: false, verificado: false, pausado: false,
      estado: 'rechazado', motivo: 'Trae un teléfono.',
    });
    // Solicitudes ya moderadas.
    await a.doc('solicitudes_servicios/S_abierta').set({
      uid: C2, nombre: 'Dos', foto: '', tipo: 'taller',
      descripcion: 'El carro vibra al frenar', repuesto: '', vehiculo: '',
      ciudad: 'Mérida', zona: '', a_domicilio: false, fotos: [],
      estado: 'abierta', creado_en: new Date(), actualizado_en: new Date(),
    });
    await a.doc('solicitudes_servicios/S_pendiente').set({
      uid: C2, nombre: 'Dos', foto: '', tipo: 'taller',
      descripcion: 'Otra cosa pendiente', repuesto: '', vehiculo: '',
      ciudad: 'Mérida', zona: '', a_domicilio: false, fotos: [],
      estado: 'pendiente', creado_en: new Date(), actualizado_en: new Date(),
    });
    await ctx.database().ref(`users/${T1}/taller`).set(true);
  });
});

after(async () => { await env?.cleanup(); });

// ── Anuncio del taller (guardarAnuncioServicio / pausarAnuncio) ─────────────
const anuncioApp = (uid, tipo, extra = {}) => ({
  nombre: 'Cauchos Uno', responsable: 'Pedro', descripcion: 'Montaje',
  ciudad: 'Mérida', zona: 'Av. Las Américas',
  ubicacion: { lat: 8.58, lng: -71.16 }, horario: 'Lun a Sáb',
  a_domicilio: true, actualizado_en: TS(), tipo,
  foto: URL_BASE + `servicios_proveedores%2F${uid}%2Flogo_${tipo}_1.jpg?alt=media&token=x`,
  portada: '', fotos: [], owner_uids: [uid], activo: false,
  verificado: false, pausado: false, estado: 'pendiente', creado_en: TS(),
  ...extra,
});

test('taller crea su anuncio con los campos de la app', () =>
  assertSucceeds(db(T1).doc(`servicios_proveedores/${T1}_cauchos`).set(anuncioApp(T1, 'cauchos'))));
test('no puede crearlo ya encendido', () =>
  assertFails(db(T1).doc(`servicios_proveedores/${T1}_remolque`).set(anuncioApp(T1, 'remolque', { activo: true }))));
test('no puede crear el anuncio con el id de otro', () =>
  assertFails(db(C1).doc(`servicios_proveedores/${T1}_bateria`).set(anuncioApp(C1, 'bateria'))));
test('no puede usar un logo de la carpeta de otro', () =>
  assertFails(db(C1).doc(`servicios_proveedores/${C1}_bateria`).set(anuncioApp(C1, 'bateria', {
    foto: URL_BASE + `servicios_proveedores%2F${T1}%2Flogo.jpg`,
  }))));
test('el dueño pausa su anuncio', () =>
  assertSucceeds(db(T1).doc(`servicios_proveedores/${T1}_taller`).update({ pausado: true, actualizado_en: TS() })));
test('el dueño NO se puede encender solo', () =>
  assertFails(db(T1).doc(`servicios_proveedores/${T1}_cauchos`).update({ activo: true, actualizado_en: TS() })));
test('el dueño agrega una foto a la galería', () =>
  assertSucceeds(db(T1).doc(`servicios_proveedores/${T1}_taller`).update({
    fotos: firebase.firestore.FieldValue.arrayUnion({ url: 'u', tipo: 'pieza', texto: '', creado_en: 1, autor_uid: T1 }),
    actualizado_en: TS(),
  })));
test('otro no toca el anuncio', () =>
  assertFails(db(C1).doc(`servicios_proveedores/${T1}_taller`).update({ pausado: false, actualizado_en: TS() })));
test('el rechazado vuelve a revisión al corregirlo', () =>
  assertSucceeds(db(T1).doc(`servicios_proveedores/${T1}_llaves`).update({
    nombre: 'Llaves Uno', descripcion: 'Copias', actualizado_en: TS(), estado: 'pendiente', motivo: '',
  })));
test('cualquiera lee los anuncios activos (obtenerProveedores)', () =>
  assertSucceeds(env.unauthenticatedContext().firestore().collection('servicios_proveedores')
    .where('tipo', '==', 'taller').where('activo', '==', true).get()));

// ── Chat del cliente (asegurarChat / _escribirMensaje / _avisarAlBot) ────────
const chatId = `${T1}_taller_${C1}`;
test('el cliente pregunta por un chat que no existe todavía', () =>
  assertSucceeds(db(C1).doc(`chats_servicios/${chatId}`).get()));
test('el cliente crea el chat', async () => {
  // El taller está pausado por una prueba anterior: se vuelve a encender.
  await assertSucceeds(db(T1).doc(`servicios_proveedores/${T1}_taller`).update({ pausado: false, actualizado_en: TS() }));
  await assertSucceeds(db(C1).doc(`chats_servicios/${chatId}`).set({
    proveedor_id: `${T1}_taller`, servicio: 'taller', proveedor_nombre: 'Taller Uno',
    proveedor_foto: '', cliente_uid: C1, cliente_nombre: 'Uno', cliente_foto: '',
    participantes: [C1, T1], leido_en: {}, creado_en: TS(), actualizado_en: TS(),
  }));
});
test('no se puede crear un chat con un servicio apagado', () =>
  assertFails(db(C1).doc(`chats_servicios/${T1}_llaves_${C1}`).set({
    proveedor_id: `${T1}_llaves`, servicio: 'llaves', proveedor_nombre: 'Llaves',
    proveedor_foto: '', cliente_uid: C1, cliente_nombre: 'Uno', cliente_foto: '',
    participantes: [C1, T1], leido_en: {}, creado_en: TS(), actualizado_en: TS(),
  })));

const mensajeApp = (uid, rol, extra = {}) => ({
  autor_uid: uid, autor_rol: rol, tipo: 'texto', texto: 'Hola, ¿revisan frenos?',
  url: '', duracion: 0, estado: 'pendiente', visible_para: [uid],
  creado_en: TS(), enviado_ms: Date.now(), ...extra,
});
let idMensaje;
test('el cliente manda un texto (nace pendiente y solo suyo)', async () => {
  const ref = await assertSucceeds(db(C1).collection(`chats_servicios/${chatId}/mensajes`).add(mensajeApp(C1, 'cliente')));
  idMensaje = ref.id;
});
test('no puede mandarlo ya visible para el otro', () =>
  assertFails(db(C1).collection(`chats_servicios/${chatId}/mensajes`).add(mensajeApp(C1, 'cliente', { visible_para: [C1, T1] }))));
test('no puede mandarlo ya aprobado', () =>
  assertFails(db(C1).collection(`chats_servicios/${chatId}/mensajes`).add(mensajeApp(C1, 'cliente', { estado: 'aprobado' }))));
test('no puede hacerse pasar por el taller', () =>
  assertFails(db(C1).collection(`chats_servicios/${chatId}/mensajes`).add(mensajeApp(C1, 'proveedor'))));
test('foto subida a su carpeta del chat', () =>
  assertSucceeds(db(C1).collection(`chats_servicios/${chatId}/mensajes`).add(mensajeApp(C1, 'cliente', {
    tipo: 'imagen', texto: '',
    url: URL_BASE + `chats_servicios%2F${chatId}%2F${C1}%2F1.jpg?alt=media&token=x`,
  }))));
test('foto con enlace de afuera: rechazada', () =>
  assertFails(db(C1).collection(`chats_servicios/${chatId}/mensajes`).add(mensajeApp(C1, 'cliente', {
    tipo: 'imagen', texto: '', url: 'https://evil.example.com/x.jpg',
  }))));
test('un extraño no escribe en el chat', () =>
  assertFails(db(X).collection(`chats_servicios/${chatId}/mensajes`).add(mensajeApp(X, 'cliente'))));
test('el taller NO ve el pendiente del cliente', () =>
  assertFails(db(T1).doc(`chats_servicios/${chatId}/mensajes/${idMensaje}`).get()));
test('el cliente lista sus mensajes (escucharMensajes)', () =>
  assertSucceeds(db(C1).collection(`chats_servicios/${chatId}/mensajes`)
    .where('visible_para', 'array-contains', C1).orderBy('creado_en', 'desc').limit(300).get()));
test('el cliente pide aviso al bot', () =>
  assertSucceeds(db(C1).collection('avisos_bot').add({
    tipo: 'chat_servicio', chat_id: chatId, mensaje_id: idMensaje,
    proveedor_id: `${T1}_taller`, remitente_uid: C1, para: 'proveedor',
    estado: 'pendiente', creado_en: TS(),
  })));
test('nadie lee la cola del bot', () =>
  assertFails(db(C1).collection('avisos_bot').get()));
test('el cliente marca leído lo suyo', () =>
  assertSucceeds(db(C1).doc(`chats_servicios/${chatId}`).update({ [`leido_en.${C1}`]: TS() })));
test('no marca leído por el otro', () =>
  assertFails(db(C1).doc(`chats_servicios/${chatId}`).update({ [`leido_en.${T1}`]: TS() })));
test('el taller ve su bandeja (escucharMisChats)', () =>
  assertSucceeds(db(T1).collection('chats_servicios')
    .where('participantes', 'array-contains', T1).orderBy('actualizado_en', 'desc').limit(100).get()));
test('un extraño no lee el chat', () =>
  assertFails(db(X).doc(`chats_servicios/${chatId}`).get()));
test('el taller contesta en el chat', () =>
  assertSucceeds(db(T1).collection(`chats_servicios/${chatId}/mensajes`).add(mensajeApp(T1, 'proveedor'))));

// ── Solicitudes (crearSolicitudServicio / responderSolicitud) ───────────────
test('el cliente publica una solicitud con los campos de la app', () =>
  assertSucceeds(db(C1).collection('solicitudes_servicios').add({
    uid: C1, nombre: 'Uno', foto: '', tipo: 'cauchos',
    descripcion: 'Necesito montar dos cauchos', repuesto: 'Caucho 185/65 R14',
    vehiculo: 'Corolla 2010', ciudad: 'Mérida', zona: 'Centro', a_domicilio: true,
    fotos: [URL_BASE + `solicitudes_servicios%2F${C1}%2F1_0.jpg?alt=media&token=x`],
    estado: 'pendiente', creado_en: TS(), actualizado_en: TS(),
  })));
test('no la puede publicar ya abierta', () =>
  assertFails(db(C1).collection('solicitudes_servicios').add({
    uid: C1, nombre: 'Uno', foto: '', tipo: 'cauchos', descripcion: 'Necesito montar dos cauchos',
    repuesto: '', vehiculo: '', ciudad: 'Mérida', zona: '', a_domicilio: false, fotos: [],
    estado: 'abierta', creado_en: TS(), actualizado_en: TS(),
  })));
test('los talleres listan las abiertas (escucharSolicitudesAbiertas)', () =>
  assertSucceeds(db(T1).collection('solicitudes_servicios')
    .where('tipo', '==', 'taller').where('estado', '==', 'abierta')
    .orderBy('creado_en', 'desc').limit(60).get()));
test('el dueño lista las suyas (escucharMisSolicitudes)', () =>
  assertSucceeds(db(C2).collection('solicitudes_servicios')
    .where('uid', '==', C2).orderBy('creado_en', 'desc').limit(50).get()));
test('nadie más ve una solicitud pendiente', () =>
  assertFails(db(T1).doc('solicitudes_servicios/S_pendiente').get()));
const chatSolicitud = `${T1}_taller_${C2}`;
test('el taller responde una solicitud abierta', () =>
  assertSucceeds(db(T1).doc(`chats_servicios/${chatSolicitud}`).set({
    proveedor_id: `${T1}_taller`, servicio: 'taller', proveedor_nombre: 'Taller Uno',
    proveedor_foto: '', cliente_uid: C2, cliente_nombre: 'Dos', cliente_foto: '',
    participantes: [C2, T1], leido_en: {}, solicitud_id: 'S_abierta',
    solicitud_texto: 'El carro vibra al frenar', creado_en: TS(), actualizado_en: TS(),
  })));
test('no puede responder una pendiente', () =>
  assertFails(db(T1).doc(`chats_servicios/${T1}_cauchos_${C2}`).set({
    proveedor_id: `${T1}_taller`, servicio: 'taller', proveedor_nombre: 'Taller Uno',
    proveedor_foto: '', cliente_uid: C2, cliente_nombre: 'Dos', cliente_foto: '',
    participantes: [C2, T1], leido_en: {}, solicitud_id: 'S_pendiente',
    solicitud_texto: 'x', creado_en: TS(), actualizado_en: TS(),
  })));
test('el dueño cierra su solicitud', () =>
  assertSucceeds(db(C2).doc('solicitudes_servicios/S_abierta').update({ estado: 'cerrada', actualizado_en: TS() })));

// ── Opiniones (guardarOpinion) ───────────────────────────────────────────────
const opinion = (uid) => ({
  uid, nombre: 'Uno', foto: '', estrellas: 5, texto: 'Muy bien',
  actualizado_en: TS(), creado_en: TS(),
});
test('opina quien tiene chat con el servicio', () =>
  assertSucceeds(db(C1).doc(`servicios_proveedores/${T1}_taller/opiniones/${C1}`).set(opinion(C1))));
test('el cliente de una solicitud también puede opinar', () =>
  assertSucceeds(db(C2).doc(`servicios_proveedores/${T1}_taller/opiniones/${C2}`).set(opinion(C2))));
test('sin chat no se opina', () =>
  assertFails(db(X).doc(`servicios_proveedores/${T1}_taller/opiniones/${X}`).set(opinion(X))));
test('el dueño no opina sobre lo suyo', () =>
  assertFails(db(T1).doc(`servicios_proveedores/${T1}_taller/opiniones/${T1}`).set(opinion(T1))));
test('cambia su opinión (update sin creado_en)', () =>
  assertSucceeds(db(C1).doc(`servicios_proveedores/${T1}_taller/opiniones/${C1}`).update({
    uid: C1, nombre: 'Uno', foto: '', estrellas: 4, texto: 'Bien', actualizado_en: TS(),
  })));
test('no se puede des-ocultar ni ocultar sola', () =>
  assertFails(db(C1).doc(`servicios_proveedores/${T1}_taller/opiniones/${C1}`).update({ oculta: true, actualizado_en: TS() })));

// ── Reportes y lo que ya existía ─────────────────────────────────────────────
test('reportar un chat (reportarContenido)', () =>
  assertSucceeds(db(C1).collection('reportes').add({
    tipo: 'chat_servicio', contenido_id: chatId, autor_id: T1, reportado_por: C1,
    motivo: 'spam', detalle: '', resumen: 'x', estado: 'pendiente',
    plataforma: 'android', creado_en: TS(),
  })));
test('merida sigue siendo de lectura pública', () =>
  assertSucceeds(env.unauthenticatedContext().firestore().collection('merida').limit(1).get()));
test('Mis vehículos acepta las fotos', () =>
  assertSucceeds(db(C1).collection('vehiculos_usuarios').add({
    uid: C1, tipo: 'carro', marca: 'Chevrolet', modelo: 'Optra', anio: 2008,
    apodo: '', color: '', creado_en: Date.now(), fotos: [{ id: 'a', url: 'u' }],
  })));

// ── Storage ─────────────────────────────────────────────────────────────────
const subir = (uid, ruta, tipo = 'image/jpeg') => {
  const s = uid ? env.authenticatedContext(uid).storage() : env.unauthenticatedContext().storage();
  return s.ref(ruta).put(new Uint8Array([1, 2, 3]), { contentType: tipo });
};
test('storage: logo en su carpeta', () => assertSucceeds(subir(T1, `servicios_proveedores/${T1}/logo_taller_1.jpg`)));
test('storage: no en la carpeta de otro', () => assertFails(subir(C1, `servicios_proveedores/${T1}/x.jpg`)));
test('storage: nota de voz del chat', () => assertSucceeds(subir(C1, `chats_servicios/${chatId}/${C1}/1.m4a`, 'audio/mp4')));
test('storage: nota de voz en carpeta ajena del chat', () => assertFails(subir(C1, `chats_servicios/${chatId}/${T1}/1.m4a`, 'audio/mp4')));
test('storage: foto de solicitud', () => assertSucceeds(subir(C1, `solicitudes_servicios/${C1}/1_0.jpg`)));
test('storage: foto de Mis vehículos', () => assertSucceeds(subir(C1, `vehiculos_modelos/carro/chevrolet/optra/${C1}_1.jpg`)));
test('storage: Mis vehículos sin su uid en el nombre', () => assertFails(subir(C1, 'vehiculos_modelos/carro/chevrolet/optra/otro.jpg')));
test('storage: imagenrep sigue abierto como en producción', () => assertSucceeds(subir(null, 'imagenrep/alguien/x.jpg')));

// ── Realtime Database: el candado de `taller` ───────────────────────────────
const rtdb = (uid) => env.authenticatedContext(uid).database();
test('rtdb: nadie se pone taller: true solo', () => assertFails(rtdb(C1).ref(`users/${C1}/taller`).set(true)));
test('rtdb: tampoco metiéndolo en un update del perfil', () =>
  assertFails(rtdb(C1).ref(`users/${C1}`).update({ nombre: 'Uno', taller: true })));
test('rtdb: el perfil se sigue editando', () => assertSucceeds(rtdb(C1).ref(`users/${C1}`).update({ nombre: 'Uno' })));
test('rtdb: el taller edita su perfil sin perder el sello', () =>
  assertSucceeds(rtdb(T1).ref(`users/${T1}`).update({ nombre: 'Pedro' })));
test('rtdb: el taller no cambia su sello', () => assertFails(rtdb(T1).ref(`users/${T1}/taller`).set('true')));
test('rtdb: users de otro sigue privado', () => assertFails(rtdb(C1).ref(`users/${T1}`).get()));
test('rtdb: el taller lee su sello (escucharTaller)', () => assertSucceeds(rtdb(T1).ref(`users/${T1}/taller`).get()));
