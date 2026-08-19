import { DELIVERY_TYPES } from './game.js';

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = Math.max(320, rect.width);
    const cssHeight = Math.max(360, rect.height);
    this.canvas.width = Math.round(cssWidth * this.dpr);
    this.canvas.height = Math.round(cssHeight * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.viewWidth = cssWidth;
    this.viewHeight = cssHeight;
    const pad = 42;
    this.scale = Math.min((cssWidth - pad * 2) / this.game.width, (cssHeight - pad * 2) / this.game.height);
    this.offsetX = (cssWidth - this.game.width * this.scale) / 2;
    this.offsetY = (cssHeight - this.game.height * this.scale) / 2;
  }

  worldToScreen(x, y) {
    return { x: this.offsetX + x * this.scale, y: this.offsetY + y * this.scale };
  }

  screenToWorld(x, y) {
    return { x: (x - this.offsetX) / this.scale, y: (y - this.offsetY) / this.scale };
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.viewWidth, this.viewHeight);
    this.drawBackdrop();
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
    this.drawDistricts();
    this.drawEdges();
    this.drawNodes();
    this.drawRoutes();
    this.drawDeliveries();
    this.drawCouriers();
    ctx.restore();
  }

  drawBackdrop() {
    const ctx = this.ctx;
    const gradient = ctx.createLinearGradient(0, 0, this.viewWidth, this.viewHeight);
    gradient.addColorStop(0, '#08111f');
    gradient.addColorStop(1, '#101a2d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#ffffff';
    for (let x = 20; x < this.viewWidth; x += 36) {
      for (let y = 20; y < this.viewHeight; y += 36) ctx.fillRect(x, y, 1.2, 1.2);
    }
    ctx.globalAlpha = 1;
  }

  drawDistricts() {
    const ctx = this.ctx;
    for (const district of this.game.districts) {
      ctx.beginPath();
      ctx.arc(district.cx, district.cy, district.radius, 0, Math.PI * 2);
      const hot = district.id === this.game.hotDistrictId;
      ctx.fillStyle = `${district.color}${hot ? '32' : '20'}`;
      ctx.fill();
      ctx.strokeStyle = `${district.color}66`;
      ctx.lineWidth = hot ? 6 : 3;
      ctx.setLineDash(hot ? [14, 7] : [9, 12]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = district.color;
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(district.name.toUpperCase(), district.cx, district.cy - district.radius - 10);
    }
  }

  drawEdges() {
    const ctx = this.ctx;
    const byId = new Map(this.game.nodes.map((node) => [node.id, node]));
    ctx.lineCap = 'round';
    for (const edge of this.game.edges) {
      const a = byId.get(edge.a);
      const b = byId.get(edge.b);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = edge.bikeLane ? '#4ef2c2' : '#33425c';
      ctx.lineWidth = edge.bikeLane ? 5 : 3;
      ctx.globalAlpha = edge.bikeLane ? 0.9 : 0.68;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawNodes() {
    const ctx = this.ctx;
    for (const node of this.game.nodes) {
      const district = this.game.districts.find((item) => item.id === node.districtId);
      const r = node.kind === 'depot' ? 11 : 4.2;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = node.kind === 'depot' ? '#ffffff' : district.color;
      ctx.fill();
      if (node.kind === 'depot') {
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = '#0b1324';
        ctx.font = '800 10px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('HUB', node.x, node.y + 0.5);
      }
    }
  }

  drawRoutes() {
    const ctx = this.ctx;
    const byId = new Map(this.game.nodes.map((node) => [node.id, node]));
    for (const courier of this.game.couriers) {
      if (courier.path.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(courier.x, courier.y);
      for (let i = courier.pathIndex; i < courier.path.length; i += 1) {
        const node = byId.get(courier.path[i]);
        ctx.lineTo(node.x, node.y);
      }
      ctx.strokeStyle = courier.color;
      ctx.lineWidth = 5;
      ctx.globalAlpha = 0.55;
      ctx.setLineDash([8, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  }

  drawDeliveries() {
    const ctx = this.ctx;
    const time = performance.now() / 1000;
    for (const delivery of this.game.activeDeliveries()) {
      const pickup = this.game.nodeById(delivery.pickupId);
      const dropoff = this.game.nodeById(delivery.dropoffId);
      const node = delivery.pickedUp ? dropoff : pickup;
      const type = DELIVERY_TYPES[delivery.type];
      const urgency = this.game.urgency(delivery);
      const selected = this.game.selectedDeliveryId === delivery.id;
      const pulse = urgency < 0.3 ? 1 + Math.sin(time * 7) * 0.13 : 1;
      const radius = (selected ? 18 : 14) * pulse;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#08111f';
      ctx.fill();
      ctx.strokeStyle = type.color;
      ctx.lineWidth = selected ? 6 : 4;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * urgency);
      ctx.strokeStyle = urgency < 0.3 ? '#ff3b56' : '#eaf4ff';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = type.color;
      ctx.font = '800 16px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(delivery.pickedUp ? '◎' : type.glyph, node.x, node.y + 0.5);
    }
  }

  drawCouriers() {
    const ctx = this.ctx;
    for (const courier of this.game.couriers) {
      const selected = this.game.selectedCourierId === courier.id;
      ctx.save();
      ctx.translate(courier.x, courier.y);
      ctx.beginPath();
      ctx.arc(0, 0, selected ? 14 : 11, 0, Math.PI * 2);
      ctx.fillStyle = '#07101f';
      ctx.fill();
      ctx.strokeStyle = courier.color;
      ctx.lineWidth = selected ? 6 : 4;
      ctx.stroke();
      ctx.fillStyle = courier.color;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(7, 6);
      ctx.lineTo(-7, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}
