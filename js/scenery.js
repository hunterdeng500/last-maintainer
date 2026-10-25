/**
 * Small, hand-built pixel dioramas. Faces share a south-facing baseline;
 * roof overhangs are deliberately excluded from the ground footprints.
 */
export const BUILDING_ORIGIN = Object.freeze({ x: 180, y: 166 });
export const BUILDING_SIZE = Object.freeze({ width: 360, height: 272 });

const FOOTPRINTS = {
  1: [76, 140, 208, 64],
  2: [38, 144, 264, 60],
  3: [74, 136, 214, 68],
  4: [58, 130, 244, 74],
  5: [88, 140, 194, 64],
  6: [58, 138, 244, 66],
};

// Ground contours in sprite coordinates. The north edge deliberately stops
// below the roof: a character can walk behind its overhang. The southeast
// edges follow the recessed foundation faces, instead of their bounding box.
const GROUND_SHAPES = {
  1: [
    [[76,140],[284,140],[284,180],[256,204],[76,204]],
  ],
  2: [38,126,214].map(x => [
    [x,144],[x+84,144],[x+84,192],[x+70,204],[x,204],
  ]),
  3: [
    [[74,136],[288,136],[288,180],[260,204],[74,204]],
  ],
  4: [
    [[100,130],[260,130],[276,136],[302,162],[276,188],
      [234,204],[126,204],[84,188],[58,162],[84,136]],
  ],
  5: [
    [[88,140],[282,140],[282,182],[252,204],[88,204]],
    [[200,194],[262,194],[262,204],[200,204]], // lowest stair
  ],
  6: [
    [[58,138],[188,138],[188,178],[156,204],[58,204]],
    [[172,138],[302,138],[302,178],[270,204],[172,204]],
    [[156,138],[172,138],[172,194],[156,194]], // inset connecting door
  ],
};

function insideConvexPolygon(x, y, vertices) {
  let positive = false, negative = false;
  for (let index = 0; index < vertices.length; index++) {
    const [ax, ay] = vertices[index], [bx, by] = vertices[(index + 1) % vertices.length];
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    positive ||= cross > 0;
    negative ||= cross < 0;
    if (positive && negative) return false;
  }
  return true;
}

export function isBuildingBlocked(site, x, y) {
  const localX = x - site.x + BUILDING_ORIGIN.x;
  const localY = y - site.y + BUILDING_ORIGIN.y;
  const [left, top, width, height] = FOOTPRINTS[site.id] || FOOTPRINTS[1];
  if (localX < left || localX > left + width || localY < top || localY > top + height) return false;
  return (GROUND_SHAPES[site.id] || GROUND_SHAPES[1])
    .some(vertices => insideConvexPolygon(localX, localY, vertices));
}

export function getBuildingFootprint(site) {
  const [x, y, width, height] = FOOTPRINTS[site.id] || FOOTPRINTS[1];
  return { x: site.x + x - BUILDING_ORIGIN.x, y: site.y + y - BUILDING_ORIGIN.y, width, height };
}

const C = {
  ink: '#594b3c', woodDark: '#705239', wood: '#a5754a', woodLight: '#cea16c',
  cream: '#e4c79a', creamLight: '#f5ddb0', plaster: '#d8bb8d', wallDark: '#a98b65',
  stoneDark: '#797660', stone: '#a5a087', stoneLight: '#ccc3a2',
  glassDark: '#486b67', glass: '#77a39a', glassLight: '#afd1b4',
  roofDark: '#914e3e', roof: '#c27250', roofLight: '#df9967', roofEdge: '#f0ba7e',
  leaf: '#5e7c49', leafLight: '#96aa61', gold: '#e7b965',
};
const snap = n => Math.round(n / 2) * 2;
function r(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  const left = snap(x), top = snap(y);
  ctx.fillRect(left, top, Math.max(2, snap(x + w) - left), Math.max(2, snap(y + h) - top));
}
// Scan-convert in two-pixel steps: diagonals keep the same crisp grid as beams,
// roof tiles and windows, without antialiased polygon edges.
function p(ctx, points, color) {
  const ys = points.map(point => point[1]);
  const top = Math.floor(Math.min(...ys) / 2) * 2;
  const bottom = Math.ceil(Math.max(...ys) / 2) * 2;
  ctx.fillStyle = color;
  for (let y = top; y < bottom; y += 2) {
    const crossings = [], sample = y + 1;
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      if ((a[1] <= sample && b[1] > sample) || (b[1] <= sample && a[1] > sample)) {
        crossings.push(a[0] + (sample - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i < crossings.length; i += 2) {
      const left = snap(crossings[i]), right = snap(crossings[i + 1]);
      if (right > left) ctx.fillRect(left, y, right - left, 2);
    }
  }
}
function line(ctx, x1, y1, x2, y2, color, width = 2) {
  const length = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let n = 0; n <= length; n += 2) {
    const t = length ? n / length : 0;
    r(ctx, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, width, width, color);
  }
}
function sign(ctx, label, x, y, w, h, colors = [C.woodDark, C.creamLight, C.woodDark]) {
  r(ctx, x, y, w, h, colors[0]); r(ctx, x + 4, y + 4, w - 8, h - 8, colors[1]);
  r(ctx, x + 4, y + 4, w - 8, 2, '#fff0c1');
  ctx.fillStyle = colors[2]; ctx.font = 'bold 12px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + w / 2, y + h / 2 + 1);
}
function window(ctx, x, y, w = 28, h = 26, lit = true) {
  r(ctx, x - 4, y - 4, w + 8, h + 10, C.woodDark);
  r(ctx, x - 2, y - 2, w + 4, h + 4, C.woodLight);
  r(ctx, x, y, w, h, lit ? '#e4bd74' : C.glassDark);
  r(ctx, x + 2, y + 2, w - 4, h - 4, lit ? '#f5d795' : C.glass);
  r(ctx, x + 2, y + 2, 4, h - 4, lit ? '#fff0bc' : C.glassLight);
  r(ctx, x + w / 2 - 2, y, 4, h, C.wood); r(ctx, x, y + h / 2 - 2, w, 2, C.wood);
  r(ctx, x - 6, y + h + 2, w + 12, 4, C.woodLight);
}
function plant(ctx, x, y, bloom = '#edc478') {
  r(ctx, x - 8, y - 9, 16, 4, '#bd875b'); r(ctx, x - 6, y - 5, 12, 10, '#a66648');
  r(ctx, x - 4, y - 5, 4, 8, '#d09562');
  r(ctx, x - 2, y - 24, 4, 16, C.leaf); r(ctx, x - 8, y - 18, 14, 4, C.leaf);
  r(ctx, x + 2, y - 24, 8, 6, C.leafLight); r(ctx, x - 8, y - 28, 8, 8, bloom);
  r(ctx, x - 6, y - 26, 4, 4, '#f9dda0');
}
function foundation(ctx, x, w, backX = 28, backY = 24) {
  p(ctx, [[x,194],[x+backX,194-backY],[x+w+backX,194-backY],[x+w,194]], C.stoneLight);
  p(ctx, [[x+w,194],[x+w+backX,194-backY],[x+w+backX,204-backY],[x+w,204]], C.stoneDark);
  r(ctx, x, 194, w, 10, C.stone); r(ctx, x, 194, w, 3, '#d8cba8');
  for (let xx = x + 22; xx < x + w; xx += 34) r(ctx, xx, 198, 2, 6, '#8e8a70');
}
function wall(ctx, x, top, w, bottom = 194, sideX = 28, sideY = 24, face = C.cream) {
  p(ctx, [[x+w,top],[x+w+sideX,top-sideY],[x+w+sideX,bottom-sideY],[x+w,bottom]], C.wallDark);
  r(ctx, x, top, w, bottom - top, face);
  r(ctx, x, top, w, 8, '#ae8960'); r(ctx, x + 4, top + 8, w - 8, 4, '#cbb083');
  r(ctx, x, bottom - 8, w, 8, '#b3946a');
  r(ctx, x, top, 6, bottom - top, C.wood); r(ctx, x+w-6, top, 6, bottom-top, C.woodDark);
  line(ctx, x+w+sideX-4, top-sideY+4, x+w+sideX-4, bottom-sideY-2, '#8f7050', 4);
  line(ctx, x+w, bottom-8, x+w+sideX, bottom-sideY-8, '#80684b', 4);
}
function chimney(ctx, x, y, h = 38, color = '#bba589') {
  p(ctx, [[x+18,y],[x+26,y-6],[x+26,y+h-6],[x+18,y+h]], '#85735c');
  r(ctx, x, y, 18, h, color);
  for (let yy = y+8; yy < y+h; yy+=10) { r(ctx,x,yy,18,2,'#978168'); r(ctx,x+(yy%20?6:12),yy-6,2,6,'#aa9073'); }
  p(ctx, [[x-4,y-4],[x+4,y-10],[x+30,y-10],[x+22,y-4]], '#e3cfaa');
  r(ctx, x-4,y-4,26,6,'#ccb591'); r(ctx,x+2,y-6,16,2,'#675e4d');
}
function shopRoof(ctx) {
  // The warm, broad south pitch is broken into orderly terracotta courses.
  p(ctx, [[64,130],[92,48],[254,48],[304,104],[268,132]], C.roofDark);
  p(ctx, [[68,122],[94,50],[252,50],[266,122]], C.roof);
  p(ctx, [[252,50],[266,42],[302,100],[266,124]], '#a15a42');
  for (let row = 0; row < 6; row++) {
    const y = 58+row*12, left = 94-(y-50)*.35, right = 252+(y-50)*.19;
    r(ctx,left,y,right-left,3,C.roofLight); r(ctx,left-2,y+8,right-left+4,2,'#a85d43');
    for (let x = left + (row%2?12:24); x < right-6; x+=24) r(ctx,x,y+3,2,6,'#a55b43');
  }
  line(ctx,266,48,300,102,'#ce8c5c',4); line(ctx,270,66,286,92,'#bd754f');
  r(ctx,92,44,162,6,C.roofEdge); r(ctx,64,124,204,6,'#7f4937'); r(ctx,68,124,196,2,'#e3a06c');
  line(ctx,268,124,302,100,'#704a36',5);
}
function drawShop(ctx) {
  foundation(ctx,76,180); wall(ctx,76,124,180);
  // A narrow side window reinforces the shaded east wall.
  p(ctx,[[266,138],[278,128],[278,158],[266,168]],'#705d43');
  p(ctx,[[268,140],[276,134],[276,156],[268,162]],'#8caaa0');
  line(ctx,270,148,276,144,'#bdc7a2',2);
  r(ctx,151,154,44,40,C.woodDark); r(ctx,155,158,36,36,'#759184');
  r(ctx,160,161,26,18,'#a6c2a2'); r(ctx,160,182,26,10,'#607b6d'); r(ctx,184,182,4,4,C.gold);
  window(ctx,98,164,28,22); window(ctx,216,164,24,22);
  chimney(ctx,226,28,48); shopRoof(ctx);
  sign(ctx,'日 用 杂 货',128,80,84,28);
  // The striped awning is a second shallow roof, with a folded front valance.
  p(ctx,[[78,158],[90,136],[244,136],[260,158]],'#73513b');
  for(let i=0;i<8;i++) {
    const topX=90+i*19.25, bottomX=78+i*22.75;
    const cream=i%2===0;
    p(ctx,[[topX,136],[topX+19.25,136],[bottomX+22.75,158],[bottomX,158]],cream?'#f0d6a3':'#b9714e');
    r(ctx,bottomX,158,22.75,cream?6:8,cream?'#d7bc8e':'#975a40');
    r(ctx,topX+2,138,14,2,cream?'#ffe8ba':'#d78f60');
  }
  r(ctx,80,164,4,30,C.woodDark); r(ctx,248,164,4,30,C.woodDark);
  r(ctx,150,194,46,6,'#d9c9a3'); r(ctx,146,200,54,4,'#bfb391');
  plant(ctx,88,198,'#e5ad6c'); plant(ctx,246,198,'#d4a1a0');
}

function stall(ctx, x, palette, goods) {
  const [roof, roofLight, edge] = palette;
  // Each canopy and counter has a small shaded end face.
  p(ctx,[[x+70,154],[x+84,142],[x+84,192],[x+70,204]],'#6f5841');
  r(ctx,x,153,70,51,'#72543c'); r(ctx,x+5,157,60,25,'#595342');
  r(ctx,x+4,181,62,23,'#bb8a56'); r(ctx,x+4,184,62,3,'#dab17a');
  for(let i=0;i<4;i++) { r(ctx,x+10+i*15,187,2,14,'#91643e'); r(ctx,x+11+i*15,187,10,2,'#c89b62'); }
  r(ctx,x-2,179,76,6,'#e6bf82');
  for(let i=0;i<4;i++) {
    r(ctx,x+9+i*14,171,12,8,goods[i%goods.length]);
    r(ctx,x+11+i*14,168,8,5,goods[i%goods.length]); r(ctx,x+12+i*14,168,3,2,'#f1d3a0');
  }
  r(ctx,x+2,146,4,34,'#d7ac73'); r(ctx,x+64,146,4,34,'#d7ac73');
  p(ctx,[[x-4,157],[x+12,116],[x+70,116],[x+86,143],[x+72,157]],edge);
  p(ctx,[[x+70,116],[x+86,143],[x+72,157],[x+62,118]],edge);
  for(let i=0;i<5;i++) {
    const a=x+12+i*10, b=x-4+i*15.2;
    p(ctx,[[a,118],[a+10,118],[b+15.2,154],[b,154]],i%2?'#f0d6a5':roof);
    r(ctx,b,154,15.2,i%2?6:8,i%2?'#d6bc8b':edge);
  }
  line(ctx,x+12,116,x+62,116,roofLight,4); line(ctx,x+72,154,x+84,142,edge,4);
}
function lantern(ctx, x, y) {
  r(ctx,x-1,y-10,2,10,'#665744'); r(ctx,x-7,y,14,16,'#c99051');
  r(ctx,x-5,y-2,10,20,'#e3ac60'); r(ctx,x-2,y,4,16,'#ffe1a0');
  r(ctx,x-5,y-4,10,3,'#7a5b3d'); r(ctx,x-4,y+17,8,3,'#8f6944'); r(ctx,x,y+20,2,5,'#b77a4e');
}
function drawMarket(ctx) {
  // The two high gate posts and long cap read separately from the three stalls.
  r(ctx,64,88,12,104,C.woodDark); r(ctx,66,88,5,104,C.woodLight);
  p(ctx,[[290,88],[302,80],[302,182],[290,192]],'#76553b'); r(ctx,282,88,10,104,'#aa784a');
  r(ctx,58,90,242,12,'#80553c'); r(ctx,58,90,242,4,'#d3a26b');
  p(ctx,[[48,88],[68,66],[286,66],[314,82],[300,92]],'#76513e');
  p(ctx,[[52,84],[70,66],[284,66],[300,84]],'#b88054');
  line(ctx,70,65,284,65,'#e1b47c',4); r(ctx,50,84,250,5,'#d4a36e');
  for(let x=78;x<284;x+=28) line(ctx,x,70,x-8,82,'#996b47');
  r(ctx,133,88,8,14,'#70513b'); r(ctx,219,88,8,14,'#70513b');
  sign(ctx,'夜 市',132,94,96,30);
  line(ctx,68,109,294,108,'#6b5c46');
  for(const x of [77,116,245,284]) lantern(ctx,x,107);
  stall(ctx,48,['#aa7784','#d6a9a4','#815a69'],['#deab62','#be7651']);
  stall(ctx,136,['#cf9c54','#f1c677','#9d6c42'],['#849454','#a7b66d']);
  stall(ctx,224,['#799d8d','#b4c9a1','#537c6b'],['#bb879e','#d3a183']);
}

function vent(ctx, x, y, w = 38) {
  p(ctx,[[x,y],[x+12,y-9],[x+w+12,y-9],[x+w,y]],'#d4cbb0');
  p(ctx,[[x+w,y],[x+w+12,y-9],[x+w+12,y+17],[x+w,y+26]],'#638179');
  r(ctx,x,y,w,26,'#95aaa0'); r(ctx,x,y,w,3,'#e2d6b5');
  r(ctx,x+5,y+6,w-10,15,'#4f6b65');
  for(let n=0;n<3;n++) r(ctx,x+7,y+7+n*5,w-14,2,'#afbd9e');
}
function drawMachineRoom(ctx) {
  foundation(ctx,74,186); wall(ctx,74,120,186,194,28,28,'#c6c6a9');
  // Folded standing seams and squat ventilation boxes replace domestic tiles.
  p(ctx,[[66,122],[98,64],[286,64],[298,94],[266,124]],'#42645e');
  p(ctx,[[70,114],[102,62],[284,62],[264,114]],'#88a89a');
  p(ctx,[[284,62],[298,94],[266,118],[264,112]],'#5d8174');
  for(let x=104;x<278;x+=28) {
    line(ctx,x,64,x-30,112,'#648d80',4); line(ctx,x+4,64,x-26,112,'#b5c5a6',2);
  }
  r(ctx,68,116,198,8,'#426059'); r(ctx,70,114,194,3,'#c7cfac');
  line(ctx,268,116,296,94,'#354f4a',6); line(ctx,104,62,284,62,'#d3d5ad',4);
  chimney(ctx,248,44,29,'#a5b4a2'); vent(ctx,113,76,42); vent(ctx,190,72,36);
  sign(ctx,'机 房',88,134,54,24,['#5b7163','#d5d5ad','#43594c']);
  r(ctx,154,140,78,54,'#4b5e53'); r(ctx,158,144,70,50,'#314d47');
  r(ctx,158,144,30,50,'#8b9f8c'); r(ctx,160,146,26,2,'#d6d8b2');
  r(ctx,164,152,18,24,'#68887b'); r(ctx,168,154,4,18,'#aac1a4');
  // One open leaf keeps the existing half-open-door premise visible.
  p(ctx,[[205,144],[225,150],[225,194],[205,190]],'#7f9583');
  p(ctx,[[208,148],[220,152],[220,172],[208,170]],'#577a6c');
  r(ctx,208,179,4,4,'#dfbd75'); r(ctx,152,194,82,5,'#d4cbaa');
  r(ctx,90,169,45,19,'#61766a');
  for(let y=173;y<187;y+=5) r(ctx,94,y,37,2,'#a1b59a');
  for(let i=0;i<3;i++) r(ctx,94+i*13,162,6,4,i===2?'#dab778':'#9fc890');
  p(ctx,[[269,136],[283,125],[283,162],[269,174]],'#5b7468');
  for(let y=140;y<166;y+=7) line(ctx,271,y,281,y-8,'#abc1a1',2);
  r(ctx,76,191,10,3,'#edd19b'); r(ctx,246,191,10,3,'#edd19b');
}

function oval(cx, cy, rx, ry) {
  return [[cx-rx,cy],[cx-rx*.78,cy-ry*.62],[cx-rx*.44,cy-ry],[cx+rx*.44,cy-ry],[cx+rx*.78,cy-ry*.62],[cx+rx,cy],[cx+rx*.78,cy+ry*.62],[cx+rx*.44,cy+ry],[cx-rx*.44,cy+ry],[cx-rx*.78,cy+ry*.62]];
}
function drawArena(ctx) {
  const outer = oval(180,144,122,42);
  // The front retaining wall is eighteen pixels deep, with a lit coping.
  p(ctx,outer.map(([x,y])=>[x,y+18]),'#737763');
  p(ctx,outer,'#b0af91');
  p(ctx,oval(180,142,112,36),'#d4c59b');
  p(ctx,oval(180,142,100,30),'#8e937a');
  p(ctx,oval(180,147,96,28),'#bcba96');
  p(ctx,oval(180,147,85,23),'#7e8970');
  p(ctx,oval(180,152,81,22),'#d8c99b');
  p(ctx,oval(180,153,68,17),'#e9d8a9');
  // Sparse radial joints make the continuous tiers legible as stone seats.
  for(const [x,y,xx,yy] of [[87,118,109,129],[127,104,136,120],[180,102,180,117],[231,104,222,120],[274,118,251,129],[68,145,91,145],[290,145,269,145]]) line(ctx,x,y,xx,yy,'#94977d');
  const front = [[58,144],[85,170],[126,186],[234,186],[275,170],[302,144]];
  for(let n=0;n<front.length-1;n++) line(ctx,...front[n],...front[n+1],'#d2c29a',3);
  line(ctx,88,184,128,200,'#8a8d72',3); r(ctx,128,200,104,4,'#8b8f73'); line(ctx,234,200,276,184,'#656f5d',3);
  for(const [x,y] of [[99,180],[132,188],[165,188],[198,188],[231,188],[264,180]]) r(ctx,x,y,3,12,'#5e6a57');
  // A broad stone stair comes forward to the same ground line as the other sites.
  p(ctx,[[152,178],[166,166],[194,166],[210,178]],'#e7d7aa');
  r(ctx,152,178,58,7,'#a9a586'); r(ctx,148,185,66,6,'#d8c8a0'); r(ctx,148,189,66,5,'#a4a184');
  r(ctx,144,194,74,6,'#d7c69b'); r(ctx,144,200,74,4,'#979c80');
  r(ctx,114,71,6,67,'#787c61'); r(ctx,250,71,6,67,'#787c61');
  r(ctx,114,71,3,60,'#c6bb91'); r(ctx,250,71,3,60,'#c6bb91');
  r(ctx,132,56,100,46,'#586851'); r(ctx,138,62,88,32,'#304e48');
  r(ctx,142,66,80,3,'#73987b'); r(ctx,140,94,84,4,'#a5ab85');
  r(ctx,146,75,15,10,'#9fba88'); r(ctx,167,75,4,10,'#9fba88');
  r(ctx,190,75,4,10,'#d9bb7c'); r(ctx,200,75,15,10,'#d9bb7c');
  p(ctx,[[118,78],[118,119],[141,127],[141,86]],'#b4745a');
  p(ctx,[[252,78],[252,119],[229,127],[229,86]],'#b4745a');
  line(ctx,122,83,137,89,'#dfad76',3); line(ctx,248,83,233,89,'#dfad76',3);
  r(ctx,70,154,10,6,C.leaf); r(ctx,74,149,10,6,C.leafLight);
  r(ctx,282,151,10,6,C.leaf); r(ctx,278,146,10,6,C.leafLight);
}

function drawTrainingTower(ctx) {
  // A high timber lookout and a separate low practice deck make a tall silhouette.
  foundation(ctx,88,164,30,22);
  p(ctx,[[166,74],[190,58],[190,178],[166,194]],'#8c7852');
  r(ctx,94,74,72,120,'#bdac75'); r(ctx,100,78,60,108,'#e0cea0');
  r(ctx,94,74,8,120,'#9b7748'); r(ctx,158,74,8,120,'#7c6242');
  r(ctx,100,112,58,72,'#716d49'); r(ctx,104,118,50,64,'#8d8e5e');
  line(ctx,104,121,150,179,'#ad9d64',5); line(ctx,148,121,104,179,'#b7a870',5);
  r(ctx,114,116,5,78,'#6e5739'); r(ctx,138,116,5,78,'#6e5739');
  for(let y=122;y<192;y+=12) { r(ctx,115,y,28,5,'#cbb37b'); r(ctx,116,y,26,2,'#edcf90'); }
  window(ctx,117,82,26,20,false);
  p(ctx,[[82,72],[104,34],[162,34],[194,54],[172,76]],'#6d7750');
  p(ctx,[[86,68],[106,34],[162,34],[171,68]],'#b7ba7a');
  p(ctx,[[162,34],[174,29],[194,53],[172,71]],'#89965e');
  for(let y=44;y<66;y+=10) r(ctx,104-(y-34)*.5,y,60+(y-34)*.75,3,'#d6d095');
  r(ctx,104,30,60,5,'#e1d7a0'); r(ctx,82,70,90,6,'#65704a'); line(ctx,174,71,192,54,'#516144',4);
  p(ctx,[[86,110],[110,94],[192,94],[170,112]],'#d7c18a');
  r(ctx,86,112,84,8,'#a0804f'); p(ctx,[[170,112],[192,96],[192,104],[170,120]],'#786344');
  sign(ctx,'跃 迁',101,56,58,24,['#6e774d','#e6d8a4','#6b744c']);
  // Open railings expose the elevated deck surface and its substantial supports.
  r(ctx,182,151,8,43,'#8a6843'); r(ctx,254,151,8,43,'#725a3c');
  p(ctx,[[182,148],[204,128],[282,128],[260,148]],'#d9c397');
  p(ctx,[[260,148],[282,128],[282,142],[260,162]],'#7c7952');
  r(ctx,182,148,78,14,'#b39761'); r(ctx,182,148,78,4,'#ebd4a2');
  for(let x=194;x<260;x+=14) line(ctx,x,148,x+22,130,'#ae986b');
  line(ctx,202,112,280,112,'#d3be86',4); line(ctx,182,131,202,112,'#c0ac77',4);
  for(const [x,y] of [[182,130],[202,112],[240,112],[278,112]]) {r(ctx,x,y-4,4,23,'#8b754c');r(ctx,x,y-6,4,4,'#efd19a');}
  r(ctx,186,172,72,8,'#a18a59'); line(ctx,190,179,250,192,'#967a4d',5);
  // The staircase lands exactly at the south edge of the footprint.
  for(let i=0;i<4;i++) {const x=212-i*4,y=164+i*10; r(ctx,x,y,38+i*8,6,'#d5c095');r(ctx,x,y+6,38+i*8,4,'#98865d');}
  r(ctx,92,194,76,10,'#a39b78'); r(ctx,92,194,76,3,'#d3c49a');
}

function workshopWing(ctx, x, roofColor, doorColor) {
  foundation(ctx,x,98,32,26); wall(ctx,x,124,98,194,32,26,'#d7bca1');
  // Two gables are extruded backwards: the visible roof pitches have real depth.
  p(ctx,[[x-6,126],[x+48,64],[x+80,40],[x+136,100],[x+102,128]],'#645363');
  p(ctx,[[x+48,64],[x+80,40],[x+132,100],[x+100,124]],roofColor);
  p(ctx,[[x-4,122],[x+28,98],[x+80,40],[x+48,64]],'#a48c99');
  p(ctx,[[x+2,124],[x+48,72],[x+94,124]],'#e2c6a6');
  for(let i=0;i<5;i++) {
    line(ctx,x+55+i*9,75+i*10,x+86+i*9,51+i*10,'#be9fa6',3);
    line(ctx,x+53+i*9,78+i*10,x+84+i*9,54+i*10,'#786372',2);
  }
  line(ctx,x-4,124,x+48,64,'#72596a',5); line(ctx,x+48,64,x+100,124,'#70576a',5);
  line(ctx,x+48,62,x+80,38,'#d2b5b3',5); line(ctx,x+102,124,x+133,100,'#574a58',5);
  r(ctx,x+42,96,14,18,'#967d78'); r(ctx,x+45,99,8,10,'#d7b983'); r(ctx,x+48,98,2,14,'#796353');
  r(ctx,x+4,129,90,4,'#b29276'); r(ctx,x+4,159,90,2,'#bea086');
  r(ctx,x+34,158,34,36,'#755e56'); r(ctx,x+38,162,26,32,doorColor);
  r(ctx,x+42,166,18,16,'#9db6ac'); r(ctx,x+56,184,4,4,'#edc37f');
  window(ctx,x+10,145,16,20,false); window(ctx,x+74,145,16,20,false);
  r(ctx,x+30,194,42,6,'#d9c7aa'); r(ctx,x+26,200,50,4,'#b8aa92');
}
function drawWorkshop(ctx) {
  // The rear chimneys, connector and matching roof peaks make one paired workshop.
  chimney(ctx,110,30,40,'#bba3a0'); chimney(ctx,224,30,40,'#bba3a0');
  workshopWing(ctx,58,'#9c8092','#7f9690');
  workshopWing(ctx,172,'#9c8092','#7f9690');
  r(ctx,156,146,16,48,'#958071'); r(ctx,160,151,8,37,'#5d6a60');
  sign(ctx,'双 生 工 坊',124,130,98,25,['#705c69','#e8d1b7','#6d5967']);
  // Matching work lamps and planter boxes echo the paired machines outside.
  for(const x of [87,201]) { r(ctx,x,132,14,4,'#796346');r(ctx,x+10,134,4,10,'#796346');r(ctx,x+6,143,12,6,'#e3bd79');r(ctx,x+8,145,8,4,'#ffe1a3'); }
  plant(ctx,68,198,'#c9a0b0'); plant(ctx,260,198,'#c9a0b0');
}

export function buildingSprite(site) {
  const canvas = document.createElement('canvas');
  canvas.width = BUILDING_SIZE.width; canvas.height = BUILDING_SIZE.height;
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  if (site.id === 2) ctx.translate(-10, 0);
  [drawShop, drawMarket, drawMachineRoom, drawArena, drawTrainingTower, drawWorkshop][site.id - 1]?.(ctx);
  return canvas;
}
