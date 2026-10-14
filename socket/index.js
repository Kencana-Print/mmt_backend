// socket/index.js — kolaborasi realtime Komitmen Kirim.
// Port dari MANKSI WEB manksi_backend/src/socket/index.js, disesuaikan:
// - payload JWT MMT { kdUser, nmUser, bagian, ... } dipetakan ke
//   { kode, nama, bagian } agar kontrak event sama persis dengan frontend.
// - CORS mengikuti allowlist backend (bukan refleksi origin bebas).
// - Presence in-memory (transient): cukup untuk 1 instance Node.
//   Bila backend dijalankan multi-instance/PM2 cluster, presence tidak
//   sinkron antar instance — perlu adapter eksternal (mis. Redis).

// ── State presence in-memory ──────────────────────────────────────
// Struktur: { [pjw_nomor]: { [socket.id]: { kode, nama, bagian } } }
const roomPresence = {};

const getPresenceList = (room) => {
  const members = roomPresence[room] || {};
  return Object.values(members);
};

// Normalisasi identitas user dari berbagai bentuk payload JWT/user
// (MMT: kdUser/nmUser; Manksi: kode/nama).
const toPresenceUser = (u) => ({
  kode: u?.kode || u?.kdUser || u?.username || "",
  nama: u?.nama || u?.nmUser || u?.username || "",
  bagian: u?.bagian || "",
});

const initSocket = (httpServer, opts = {}) => {
  // eslint-disable-next-line global-require
  const { Server } = require("socket.io");
  const jwt = require("jsonwebtoken");

  const allowedOrigins = opts.allowedOrigins || [];
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (!allowedOrigins.length || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    },
  });

  // ── Auth middleware — logic sama seperti verifyToken di
  // middleware/auth.middleware.js, cuma token diambil dari
  // handshake.auth (bukan header Authorization) ──
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Akses ditolak. Token tidak ada."));
    }
    jwt.verify(
      token,
      process.env.JWT_SECRET,
      { clockTolerance: 5 },
      (err, decoded) => {
        if (err) {
          return next(new Error("Sesi telah berakhir atau token tidak valid."));
        }
        socket.user = decoded;
        next();
      },
    );
  });

  io.on("connection", (socket) => {
    let currentRoom = null;

    // ── Join room per nomor Komitmen Kirim ──
    socket.on("pjw:join", (pjwNomor) => {
      if (!pjwNomor) return;

      // Kalau sebelumnya sudah join room lain, keluar dulu (jaga-jaga
      // kalau user pindah form tanpa reload penuh)
      if (currentRoom && currentRoom !== pjwNomor) {
        socket.leave(currentRoom);
        if (roomPresence[currentRoom]) {
          delete roomPresence[currentRoom][socket.id];
          io.to(currentRoom).emit("pjw:presence", getPresenceList(currentRoom));
        }
      }

      currentRoom = pjwNomor;
      socket.join(pjwNomor);

      if (!roomPresence[pjwNomor]) roomPresence[pjwNomor] = {};
      roomPresence[pjwNomor][socket.id] = toPresenceUser(socket.user);

      // Broadcast daftar presence terbaru ke SEMUA anggota room (termasuk diri sendiri)
      io.to(pjwNomor).emit("pjw:presence", getPresenceList(pjwNomor));
    });

    // ── Leave eksplisit (user pindah form tanpa close tab) ──
    socket.on("pjw:leave", (pjwNomor) => {
      if (!pjwNomor || !roomPresence[pjwNomor]) return;
      socket.leave(pjwNomor);
      delete roomPresence[pjwNomor][socket.id];
      io.to(pjwNomor).emit("pjw:presence", getPresenceList(pjwNomor));
      if (currentRoom === pjwNomor) currentRoom = null;
    });

    // ── Field focus tracking — broadcast siapa sedang di sel mana ──
    socket.on("pjw:field-focus", ({ pjwNomor, pjwdId, field }) => {
      if (!pjwNomor) return;
      const me = toPresenceUser(socket.user);
      socket.to(pjwNomor).emit("pjw:field-focus", {
        pjwdId,
        field,
        kode: me.kode,
        nama: me.nama,
      });
    });

    socket.on("pjw:field-blur", ({ pjwNomor, pjwdId, field }) => {
      if (!pjwNomor) return;
      const me = toPresenceUser(socket.user);
      socket.to(pjwNomor).emit("pjw:field-blur", {
        pjwdId,
        field,
        kode: me.kode,
      });
    });

    // ── Disconnect (tutup tab, koneksi putus, dll) ──
    socket.on("disconnect", () => {
      if (currentRoom && roomPresence[currentRoom]) {
        delete roomPresence[currentRoom][socket.id];
        io.to(currentRoom).emit("pjw:presence", getPresenceList(currentRoom));
        io.to(currentRoom).emit("pjw:user-disconnected", {
          kode: toPresenceUser(socket.user).kode,
        });
      }
    });
  });

  return io;
};

module.exports = { initSocket };
