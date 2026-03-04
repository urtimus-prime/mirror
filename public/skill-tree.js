/**
 * Standalone Skill Tree Canvas2D Renderer
 * Ported from BlockSuite skill-tree package — zero dependencies
 */
(function () {
  'use strict';

  // --- Constants (from model/types.ts) ---

  var CONST = {
    HEX_RADIUS: 40,
    NODE_WIDTH: 100,
    NODE_HEIGHT: 110,
    TIER_SPACING_Y: 180,
    NODE_SPACING_X: 160,
    SPARKLE_COUNT: 8,
    GLOW_MIN: 5,
    GLOW_MAX: 20,
    FLOW_DOT_RADIUS: 3,
    FLOW_SPEED: 0.01,
  };

  var CATEGORY_COLORS = {
    combat: { primary: '#e74c3c', background: '#2c1a1a', glow: '#ff6b6b' },
    magic: { primary: '#9b59b6', background: '#1f1a2e', glow: '#c49bde' },
    stealth: { primary: '#27ae60', background: '#1a2c1f', glow: '#5ddb92' },
  };

  var STATE_COLORS = {
    locked: { border: '#444444', fill: '#2a2a2a', opacity: 0.5 },
    available: { border: '#88aacc', fill: '#1a2a3a', opacity: 1.0 },
    unlocked: { border: '#ffffff', fill: '#2a3a4a', opacity: 1.0 },
    maxed: { border: '#ffd700', fill: '#3a3520', opacity: 1.0 },
  };

  // --- Dynamic category color fallback ---

  function hashString(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  function getCategoryColors(category) {
    if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];
    var hue = hashString(category) % 360;
    return {
      primary: 'hsl(' + hue + ', 60%, 50%)',
      background: 'hsl(' + hue + ', 30%, 12%)',
      glow: 'hsl(' + hue + ', 70%, 70%)',
    };
  }

  // --- Sparkle generation ---

  function generateSparkles() {
    var sparkles = [];
    for (var i = 0; i < CONST.SPARKLE_COUNT; i++) {
      sparkles.push({
        angle: ((Math.PI * 2) * i) / CONST.SPARKLE_COUNT,
        distance: CONST.HEX_RADIUS * 0.8 + Math.random() * CONST.HEX_RADIUS * 0.6,
        size: 2 + Math.random() * 3,
        speed: 0.3 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return sparkles;
  }

  // --- Drawing functions (from skill-node-canvas.ts) ---

  function drawHexagon(ctx, cx, cy, r) {
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var angle = (Math.PI / 3) * i;
      var x = cx + r * Math.cos(angle);
      var y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawNode(ctx, node, glowPhase) {
    ctx.save();

    var cx = node.x;
    var cy = node.y;
    var state = node.skillState;
    var catColors = getCategoryColors(node.category);
    var stateColors = STATE_COLORS[state];

    ctx.globalAlpha = stateColors.opacity;

    // Glow effect
    if (state === 'available' || state === 'unlocked' || state === 'maxed') {
      var glowColor = state === 'maxed' ? '#ffd700' : catColors.glow;
      var glowIntensity;
      if (state === 'available') {
        glowIntensity = CONST.GLOW_MIN +
          (CONST.GLOW_MAX - CONST.GLOW_MIN) *
          (0.5 + 0.5 * Math.sin(glowPhase));
      } else if (state === 'maxed') {
        glowIntensity = CONST.GLOW_MAX;
      } else {
        glowIntensity = CONST.GLOW_MIN + 3;
      }
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = glowIntensity;
    }

    // Hexagon fill with radial gradient
    var gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, CONST.HEX_RADIUS);
    if (state === 'locked') {
      gradient.addColorStop(0, '#3a3a3a');
      gradient.addColorStop(1, '#1a1a1a');
    } else {
      gradient.addColorStop(0, catColors.primary + 'cc');
      gradient.addColorStop(1, catColors.background);
    }

    drawHexagon(ctx, cx, cy, CONST.HEX_RADIUS);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Border
    drawHexagon(ctx, cx, cy, CONST.HEX_RADIUS);
    ctx.strokeStyle = stateColors.border;
    ctx.lineWidth = state === 'maxed' ? 3 : 2;
    ctx.stroke();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Sparkle particles for maxed state
    if (state === 'maxed' && node._sparkles) {
      for (var i = 0; i < node._sparkles.length; i++) {
        var spark = node._sparkles[i];
        var angle = spark.angle + glowPhase * spark.speed;
        var dist = spark.distance;
        var sx = cx + Math.cos(angle) * dist;
        var sy = cy + Math.sin(angle) * dist;
        var sparkAlpha = 0.5 + 0.5 * Math.sin(glowPhase + spark.phase);

        ctx.globalAlpha = sparkAlpha;
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        var s = spark.size;
        ctx.moveTo(sx, sy - s);
        ctx.lineTo(sx + s * 0.3, sy - s * 0.3);
        ctx.lineTo(sx + s, sy);
        ctx.lineTo(sx + s * 0.3, sy + s * 0.3);
        ctx.lineTo(sx, sy + s);
        ctx.lineTo(sx - s * 0.3, sy + s * 0.3);
        ctx.lineTo(sx - s, sy);
        ctx.lineTo(sx - s * 0.3, sy - s * 0.3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = stateColors.opacity;
    }

    // Icon emoji
    ctx.font = '24px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(node.iconEmoji, cx, cy);

    // Skill name below hexagon
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = state === 'locked' ? '#666666' : '#ffffff';
    ctx.fillText(node.skillName, cx, cy + CONST.HEX_RADIUS + 8);

    // Level indicator
    if (node.maxLevel > 1) {
      ctx.font = '10px sans-serif';
      ctx.fillStyle = state === 'maxed' ? '#ffd700' : '#aaaaaa';
      ctx.fillText(node.currentLevel + '/' + node.maxLevel, cx, cy + CONST.HEX_RADIUS + 22);
    }

    ctx.restore();
  }

  // --- Connector drawing (from skill-connector-canvas.ts) ---

  function drawConnector(ctx, connector, nodeMap, flowPhase) {
    var source = nodeMap[connector.sourceId];
    var target = nodeMap[connector.targetId];
    if (!source || !target) return;

    ctx.save();

    // Source: bottom-center of source node hexagon
    var sx = source.x;
    var sy = source.y + CONST.HEX_RADIUS;
    // Target: top-center of target node hexagon
    var tx = target.x;
    var ty = target.y - CONST.HEX_RADIUS;

    var cpOffset = Math.max(Math.abs(ty - sy) * 0.4, 40);
    var cp1x = sx;
    var cp1y = sy + cpOffset;
    var cp2x = tx;
    var cp2y = ty - cpOffset;

    if (connector.isActive) {
      // Glowing active connector
      ctx.shadowColor = '#88ccff';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, tx, ty);
      ctx.stroke();

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Bright overlay
      ctx.strokeStyle = '#88ccff';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, tx, ty);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Flowing energy dot
      var t = flowPhase;
      var it = 1 - t;
      var dotX = it*it*it*sx + 3*it*it*t*cp1x + 3*it*t*t*cp2x + t*t*t*tx;
      var dotY = it*it*it*sy + 3*it*it*t*cp1y + 3*it*t*t*cp2y + t*t*t*ty;

      var dotGradient = ctx.createRadialGradient(
        dotX, dotY, 0, dotX, dotY, CONST.FLOW_DOT_RADIUS * 3
      );
      dotGradient.addColorStop(0, '#ffffff');
      dotGradient.addColorStop(0.3, '#88ccff');
      dotGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = dotGradient;
      ctx.beginPath();
      ctx.arc(dotX, dotY, CONST.FLOW_DOT_RADIUS * 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Inactive dashed grey line
      ctx.strokeStyle = '#444444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  // --- Hit testing ---

  function hitTestNodes(nodes, mx, my) {
    var hitRadius = CONST.HEX_RADIUS * 1.2;
    for (var i = nodes.length - 1; i >= 0; i--) {
      var node = nodes[i];
      var dx = mx - node.x;
      var dy = mx - node.x; // intentional: check distance from center
      dx = mx - node.x;
      dy = my - node.y;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        return node;
      }
    }
    return null;
  }

  // --- Main init ---

  window.SkillTree = {
    init: function (canvas, data, opts) {
      var onNodeClick = (opts && opts.onNodeClick) || function () {};
      var ctx = canvas.getContext('2d');
      var dpr = window.devicePixelRatio || 1;

      // Prepare nodes with sparkle seeds
      var nodes = data.nodes;
      var connectors = data.connectors;
      var nodeMap = {};

      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        nodeMap[node.id] = node;
        if (node.skillState === 'maxed') {
          node._sparkles = generateSparkles();
        }
      }

      // Compute canvas size to fit all nodes
      var padding = 120;
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.x - CONST.HEX_RADIUS < minX) minX = n.x - CONST.HEX_RADIUS;
        if (n.x + CONST.HEX_RADIUS > maxX) maxX = n.x + CONST.HEX_RADIUS;
        if (n.y - CONST.HEX_RADIUS < minY) minY = n.y - CONST.HEX_RADIUS;
        if (n.y + CONST.NODE_HEIGHT > maxY) maxY = n.y + CONST.NODE_HEIGHT;
      }

      var canvasW = maxX - minX + padding * 2;
      var canvasH = maxY - minY + padding * 2;
      var offsetX = -minX + padding;
      var offsetY = -minY + padding;

      // Shift all node positions so they're offset properly
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].x += offsetX;
        nodes[i].y += offsetY;
      }

      function resize() {
        var rect = canvas.parentElement.getBoundingClientRect();
        var w = Math.max(rect.width, canvasW);
        var h = Math.max(rect.height, canvasH);
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
      }

      resize();

      // Animation state
      var glowPhase = 0;
      var flowPhase = 0;
      var lastTime = performance.now();
      var destroyed = false;
      var animId = 0;
      var selectedNode = null;

      function render(time) {
        if (destroyed) return;

        var dt = (time - lastTime) / 1000;
        lastTime = time;

        // Update animation phases
        glowPhase = (glowPhase + dt * 2.5) % (Math.PI * 2);
        flowPhase = (flowPhase + dt * CONST.FLOW_SPEED * 100) % 1;

        // Clear
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

        // Draw connectors first (behind nodes)
        for (var i = 0; i < connectors.length; i++) {
          drawConnector(ctx, connectors[i], nodeMap, flowPhase);
        }

        // Draw nodes
        for (var i = 0; i < nodes.length; i++) {
          drawNode(ctx, nodes[i], glowPhase);
        }

        // Draw selection ring
        if (selectedNode) {
          ctx.save();
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#c084fc';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(selectedNode.x, selectedNode.y, CONST.HEX_RADIUS + 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        ctx.restore();

        animId = requestAnimationFrame(render);
      }

      animId = requestAnimationFrame(render);

      // Click handler
      function onClick(e) {
        var rect = canvas.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;
        var hit = hitTestNodes(nodes, mx, my);
        selectedNode = hit;
        if (hit) {
          onNodeClick(hit);
        }
      }

      canvas.addEventListener('click', onClick);

      // Cursor change on hover
      function onMove(e) {
        var rect = canvas.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;
        var hit = hitTestNodes(nodes, mx, my);
        canvas.style.cursor = hit ? 'pointer' : 'default';
      }

      canvas.addEventListener('mousemove', onMove);

      window.addEventListener('resize', resize);

      return {
        destroy: function () {
          destroyed = true;
          cancelAnimationFrame(animId);
          canvas.removeEventListener('click', onClick);
          canvas.removeEventListener('mousemove', onMove);
          window.removeEventListener('resize', resize);
        },
        selectNode: function (nodeId) {
          selectedNode = nodeMap[nodeId] || null;
        },
      };
    },
  };
})();
