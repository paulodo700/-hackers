const { Server } = require('socket.io');
const { userFromToken } = require('./auth');
const { WITH_DRIVER } = require('./rides');

// Tempo real: repassa os eventos internos (bus) para as telas certas.
function attachRealtime(httpServer, { db, bus, drivers }) {
  const io = new Server(httpServer, { serveClient: true });
  const marks = WITH_DRIVER.map(() => '?').join(',');
  const room = (id) => `user:${id}`;

  io.use((socket, next) => {
    const user = userFromToken(db, socket.handshake.auth && socket.handshake.auth.token);
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket) => {
    const { user } = socket.data;
    socket.join(room(user.id));
    if (user.role === 'admin') socket.join('admins');

    if (user.role === 'driver') {
      let last = 0;
      socket.on('driver:location', (pos) => {
        const now = Date.now();
        if (now - last < 1000) return; // no máximo uma posição por segundo
        last = now;
        try {
          drivers.updateLocation(user.id, pos || {});
        } catch {
          /* posição inválida: ignora */
        }
      });
    }
  });

  bus.on('ride:update', (ride, extra = {}) => {
    if (!ride) return;
    const targets = new Set(['admins']);
    if (ride.passenger_id) targets.add(room(ride.passenger_id));
    if (ride.driver_id) targets.add(room(ride.driver_id));
    for (const id of extra.extraUserIds || []) targets.add(room(id));
    for (const target of targets) io.to(target).emit('ride:update', ride);
  });

  bus.on('ride:offer', (offer) => {
    io.to(room(offer.driverId)).emit('ride:offer', offer);
    io.to('admins').emit('offers:update');
  });
  bus.on('ride:offer_closed', (info) => {
    io.to(room(info.driverId)).emit('ride:offer_closed', info);
    io.to('admins').emit('offers:update');
  });

  bus.on('driver:location', (loc) => {
    io.to('admins').emit('driver:location', loc);
    const ride = db
      .prepare(`SELECT passenger_id FROM rides WHERE driver_id = ? AND status IN (${marks}) AND passenger_id IS NOT NULL`)
      .get(loc.driverId, ...WITH_DRIVER);
    if (ride) io.to(room(ride.passenger_id)).emit('driver:location', loc);
  });

  bus.on('drivers:update', () => io.to('admins').emit('drivers:update'));
  bus.on('driver:status', (info) => io.to(room(info.driverId)).emit('driver:status', info));

  return io;
}

module.exports = { attachRealtime };
