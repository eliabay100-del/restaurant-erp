const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');

const args = process.argv.slice(2);
const portArgIndex = args.indexOf('--port');
const dev = !args.includes('--production') && process.env.NODE_ENV !== 'production';
const portArg = portArgIndex !== -1 ? args[portArgIndex + 1] : process.env.PORT;
const port = parseInt(portArg || '3000', 10) || 3000;
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handle);

  const io = new Server(httpServer, {
    path: '/api/socketio',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Track connected clients
  let connectedClients = 0;

  io.on('connection', (socket) => {
    connectedClients++;
    console.log(`[Socket] Client connected: ${socket.id} (${connectedClients} total)`);

    // ============ ORDER EVENTS ============

    // Cashier places a new order
    socket.on('order:new', (order) => {
      const label = order?.orderNumber ?? order?.orderId ?? 'unknown';
      const table = order?.tableNumber ? ` (table ${order.tableNumber})` : '';
      console.log(`[Socket] New order: #${label}${table}`);
      // Broadcast to ALL clients (kitchen displays, other cashiers, managers)
      socket.broadcast.emit('order:new', order);
    });

    // Kitchen/cashier updates order status
    socket.on('order:status-update', (data) => {
      console.log(`[Socket] Order ${data.orderId} status -> ${data.status}`);
      // Broadcast to all other clients
      socket.broadcast.emit('order:status-update', data);
    });

    // Kitchen marks individual item as ready
    socket.on('order:item-ready', (data) => {
      console.log(`[Socket] Order ${data.orderId} item ${data.itemId} ready`);
      socket.broadcast.emit('order:item-ready', data);
    });

    // ============ SHIFT EVENTS ============

    // Cashier ends shift (needs manager approval)
    socket.on('shift:ended', (data) => {
      console.log(`[Socket] Shift ${data.shiftId} ended by ${data.staffName}`);
      socket.broadcast.emit('shift:ended', data);
    });

    // Manager approves/rejects shift
    socket.on('shift:approved', (data) => {
      console.log(`[Socket] Shift ${data.shiftId} approved`);
      socket.broadcast.emit('shift:approved', data);
    });

    socket.on('shift:rejected', (data) => {
      console.log(`[Socket] Shift ${data.shiftId} rejected`);
      socket.broadcast.emit('shift:rejected', data);
    });

    // ============ NOTIFICATION EVENTS ============

    socket.on('notification', (data) => {
      socket.broadcast.emit('notification', data);
    });

    // ============ DISCONNECT ============

    socket.on('disconnect', (reason) => {
      connectedClients--;
      console.log(`[Socket] Client disconnected: ${socket.id} (${reason}) (${connectedClients} remaining)`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`\n  🌿 Warka Dine POS Server`);
    console.log(`  ========================`);
    console.log(`  ➜  Local:   http://localhost:${port}`);
    console.log(`  ➜  Network: http://0.0.0.0:${port}`);
    console.log(`  ➜  Socket:  ws://localhost:${port}/api/socketio`);
    console.log(`  ➜  Mode:    ${dev ? 'Development' : 'Production'}`);
    console.log(`\n  Ready to take orders! 🍽️\n`);
  });
});
