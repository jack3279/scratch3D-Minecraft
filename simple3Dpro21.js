// Name: Simple 3D (完全汉化Pro版)
// ID: xeltallivSimple3D
// Description: 轻松制作 GPU 加速的 3D 项目 (涵盖全部积木与菜单汉化)
// By: Vadik1 <https://scratch.mit.edu/users/Vadik1/>
// License: MPL-2.0 AND BSD-3-Clause
// Version: 1.2.2

(function (Scratch) {
    "use strict";
  
    // === 沙盒防御拦截器 ===
    const isSandboxed = !Scratch || !Scratch.extensions || !Scratch.extensions.unsandboxed;
    if (isSandboxed) {
      class SandboxErrorExtension {
        getInfo() {
          return {
            id: 'xeltallivSimple3D',
            name: '🚨 Simple3D 加载失败',
            color1: '#cc0000',
            color2: '#aa0000',
            blocks: [{ opcode: 'errorMsg', blockType: Scratch.BlockType.REPORTER, text: '⚠️ 请务必勾选【运行在非沙盒模式下】' }]
          };
        }
        errorMsg() { return "加载失败！请删除此扩展，重新点击加载，并务必勾选弹窗下方的 'Run extension without sandbox' (运行在非沙盒模式下)"; }
      }
      Scratch.extensions.register(new SandboxErrorExtension());
      return;
    }
  
    const ArgumentType = Scratch.ArgumentType;
    const BlockType = Scratch.BlockType;
    const Cast = Scratch.Cast;
    const vm = Scratch.vm;
    const renderer = vm.renderer;
    const runtime = vm.runtime;
  
    const extensionId = "xeltallivSimple3D";
    let canvasDirty = true;
    let canvas = document.createElement("canvas");
    let gl = canvas.getContext("webgl2");
    if (!gl) alert("Simple 3D 无法获取 WebGL2 权限。请尝试重启浏览器或检查显卡支持。");
  
    const ext_af = gl.getExtension("EXT_texture_filter_anisotropic") || gl.getExtension("MOZ_EXT_texture_filter_anisotropic") || gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
    const ext_smi = gl.getExtension("OES_shader_multisample_interpolation");
    gl.enable(gl.DEPTH_TEST);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  
    const m4 = {
      perspective(fieldOfViewInRadians, aspect, near, far) {
        const f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfViewInRadians);
        const rangeInv = 1.0 / (near - far);
        return [ f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (near + far) * rangeInv, -1, 0, 0, near * far * rangeInv * 2, 0 ];
      },
      orthographic(aspect, near, far) {
        const a = 2 / (near - far), b = -1 + near * a;
        return [ 1 / aspect, 0, 0, 0, 0, 1, 0, 0, 0, 0, a, 0, 0, 0, b, 1 ];
      },
      translate(m, tx, ty, tz) {
        return [ m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9], m[10], m[11], tx * m[0] + ty * m[4] + tz * m[8] + m[12], tx * m[1] + ty * m[5] + tz * m[9] + m[13], tx * m[2] + ty * m[6] + tz * m[10] + m[14], tx * m[3] + ty * m[7] + tz * m[11] + m[15] ];
      },
      xRotate(m, angleInRadians) {
        const c = Math.cos(angleInRadians), s = Math.sin(angleInRadians);
        return [ m[0], m[1], m[2], m[3], c * m[4] + s * m[8], c * m[5] + s * m[9], c * m[6] + s * m[10], c * m[7] + s * m[11], c * m[8] - s * m[4], c * m[9] - s * m[5], c * m[10] - s * m[6], c * m[11] - s * m[7], m[12], m[13], m[14], m[15] ];
      },
      yRotate(m, angleInRadians) {
        const c = Math.cos(angleInRadians), s = Math.sin(angleInRadians);
        return [ c * m[0] - s * m[8], c * m[1] - s * m[9], c * m[2] - s * m[10], c * m[3] - s * m[11], m[4], m[5], m[6], m[7], s * m[0] + c * m[8], s * m[1] + c * m[9], s * m[2] + c * m[10], s * m[3] + c * m[11], m[12], m[13], m[14], m[15] ];
      },
      zRotate(m, angleInRadians) {
        const c = Math.cos(angleInRadians), s = Math.sin(angleInRadians);
        return [ c * m[0] + s * m[4], c * m[1] + s * m[5], c * m[2] + s * m[6], c * m[3] + s * m[7], c * m[4] - s * m[0], c * m[5] - s * m[1], c * m[6] - s * m[2], c * m[7] - s * m[3], m[8], m[9], m[10], m[11], m[12], m[13], m[14], m[15] ];
      },
      scale(m, sx, sy, sz) {
        return [ sx * m[0], sx * m[1], sx * m[2], sx * m[3], sy * m[4], sy * m[5], sy * m[6], sy * m[7], sz * m[8], sz * m[9], sz * m[10], sz * m[11], m[12], m[13], m[14], m[15] ];
      },
      multiply(a, b) {
        const a00 = a[0 * 4 + 0], a01 = a[0 * 4 + 1], a02 = a[0 * 4 + 2], a03 = a[0 * 4 + 3];
        const a10 = a[1 * 4 + 0], a11 = a[1 * 4 + 1], a12 = a[1 * 4 + 2], a13 = a[1 * 4 + 3];
        const a20 = a[2 * 4 + 0], a21 = a[2 * 4 + 1], a22 = a[2 * 4 + 2], a23 = a[2 * 4 + 3];
        const a30 = a[3 * 4 + 0], a31 = a[3 * 4 + 1], a32 = a[3 * 4 + 2], a33 = a[3 * 4 + 3];
        const b00 = b[0 * 4 + 0], b01 = b[0 * 4 + 1], b02 = b[0 * 4 + 2], b03 = b[0 * 4 + 3];
        const b10 = b[1 * 4 + 0], b11 = b[1 * 4 + 1], b12 = b[1 * 4 + 2], b13 = b[1 * 4 + 3];
        const b20 = b[2 * 4 + 0], b21 = b[2 * 4 + 1], b22 = b[2 * 4 + 2], b23 = b[2 * 4 + 3];
        const b30 = b[3 * 4 + 0], b31 = b[3 * 4 + 1], b32 = b[3 * 4 + 2], b33 = b[3 * 4 + 3];
        return [
          b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30, b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31, b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32, b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33,
          b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30, b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31, b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32, b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33,
          b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30, b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31, b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32, b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33,
          b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30, b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31, b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32, b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33,
        ];
      },
      multiplyVec: function(a, b) {
        const a00 = a[0 * 4 + 0], a01 = a[0 * 4 + 1], a02 = a[0 * 4 + 2], a03 = a[0 * 4 + 3];
        const a10 = a[1 * 4 + 0], a11 = a[1 * 4 + 1], a12 = a[1 * 4 + 2], a13 = a[1 * 4 + 3];
        const a20 = a[2 * 4 + 0], a21 = a[2 * 4 + 1], a22 = a[2 * 4 + 2], a23 = a[2 * 4 + 3];
        const a30 = a[3 * 4 + 0], a31 = a[3 * 4 + 1], a32 = a[3 * 4 + 2], a33 = a[3 * 4 + 3];
        const b00 = b[0], b01 = b[1], b02 = b[2], b03 = b[3];
        return [ b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30, b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31, b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32, b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33 ];
      },
      identity() { return [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  0, 0, 0, 1]; },
      zero: function() { return [0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0]; },
      inverse: function(m) {
        const inv = [
           m[5] * m[10] * m[15] - m[5]  * m[11] * m[14] - m[9]  * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10],
          -m[1] * m[10] * m[15] + m[1]  * m[11] * m[14] + m[9]  * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10],
           m[1] * m[6]  * m[15] - m[1]  * m[7]  * m[14] - m[5]  * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7]  - m[13] * m[3] * m[6],
          -m[1] * m[6]  * m[11] + m[1]  * m[7]  * m[10] + m[5]  * m[2] * m[11] - m[5] * m[3] * m[10] - m[9]  * m[2] * m[7]  + m[9]  * m[3] * m[6],
          -m[4] * m[10] * m[15] + m[4]  * m[11] * m[14] + m[8]  * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10],
           m[0] * m[10] * m[15] - m[0]  * m[11] * m[14] - m[8]  * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10],
          -m[0] * m[6]  * m[15] + m[0]  * m[7]  * m[14] + m[4]  * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7]  + m[12] * m[3] * m[6],
           m[0] * m[6]  * m[11] - m[0]  * m[7]  * m[10] - m[4]  * m[2] * m[11] + m[4] * m[3] * m[10] + m[8]  * m[2] * m[7]  - m[8]  * m[3] * m[6],
           m[4] * m[9]  * m[15] - m[4]  * m[11] * m[13] - m[8]  * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9],
          -m[0] * m[9]  * m[15] + m[0]  * m[11] * m[13] + m[8]  * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9],
           m[0] * m[5]  * m[15] - m[0]  * m[7]  * m[13] - m[4]  * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7]  - m[12] * m[3] * m[5],
          -m[0] * m[5]  * m[11] + m[0]  * m[7]  * m[9]  + m[4]  * m[1] * m[11] - m[4] * m[3] * m[9]  - m[8]  * m[1] * m[7]  + m[8]  * m[3] * m[5],
          -m[4] * m[9]  * m[14] + m[4]  * m[10] * m[13] + m[8]  * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9],
           m[0] * m[9]  * m[14] - m[0]  * m[10] * m[13] - m[8]  * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9],
          -m[0] * m[5]  * m[14] + m[0]  * m[6]  * m[13] + m[4]  * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6]  + m[12] * m[2] * m[5],
           m[0] * m[5]  * m[10] - m[0]  * m[6]  * m[9]  - m[4]  * m[1] * m[10] + m[4] * m[2] * m[9]  + m[8]  * m[1] * m[6]  - m[8]  * m[2] * m[5]
        ];
        const det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
        if (det == 0) return m4.zero();
        const invDet = 1 / det;
        for(let i=0; i<16; i++) inv[i] *= invDet;
        return inv;
      },
      // === 新增代码 1: 向量与 LookAt 数学库 ===
    subtractVectors(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; },
    normalize(v) {
      let length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
      return length > 0.00001 ? [v[0] / length, v[1] / length, v[2] / length] : [0, 0, 0];
    },
    cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; },
    lookAt(cameraPosition, target, up) {
      let zAxis = this.normalize(this.subtractVectors(cameraPosition, target));
      let xAxis = this.normalize(this.cross(up, zAxis));
      let yAxis = this.normalize(this.cross(zAxis, xAxis));
      return [
        xAxis[0], xAxis[1], xAxis[2], 0,
        yAxis[0], yAxis[1], yAxis[2], 0,
        zAxis[0], zAxis[1], zAxis[2], 0,
        cameraPosition[0], cameraPosition[1], cameraPosition[2], 1,
      ];
    },
    // ===
    };
  
    const hasOwn = (obj, name) => Object.prototype.hasOwnProperty.call(obj, name);
    // === 新增代码 2: 内置几何体生成算法 ===
  const PrimitiveGen = {
    createCube: function() {
      const p = [ -1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1, -1,-1,1, 1,-1,1, 1,1,1, -1,1,1, -1,-1,-1, -1,-1,1, -1,1,1, -1,1,-1, 1,-1,-1, 1,-1,1, 1,1,1, 1,1,-1, -1,-1,-1, -1,-1,1, 1,-1,1, 1,-1,-1, -1,1,-1, -1,1,1, 1,1,1, 1,1,-1 ];
      const uv = [ 1,1, 0,1, 0,0, 1,0, 0,1, 1,1, 1,0, 0,0, 0,1, 1,1, 1,0, 0,0, 1,1, 0,1, 0,0, 1,0, 0,0, 0,1, 1,1, 1,0, 0,1, 0,0, 1,0, 1,1 ];
      const i = [ 0,1,2, 0,2,3, 4,5,6, 4,6,7, 8,9,10, 8,10,11, 12,13,14, 12,14,15, 16,17,18, 16,18,19, 20,21,22, 20,22,23 ];
      return { p: new Float32Array(p), uv: new Float32Array(uv), i: new Uint16Array(i) };
    },
    createSphere: function(radius, latBands, lonBands) {
      let p = [], uv = [], i = [];
      for (let lat = 0; lat <= latBands; lat++) {
        let theta = lat * Math.PI / latBands;
        let sinTheta = Math.sin(theta), cosTheta = Math.cos(theta);
        for (let lon = 0; lon <= lonBands; lon++) {
          let phi = lon * 2 * Math.PI / lonBands;
          p.push(radius * Math.cos(phi) * sinTheta, radius * cosTheta, radius * Math.sin(phi) * sinTheta);
          uv.push(1 - (lon / lonBands), (lat / latBands));
        }
      }
      for (let lat = 0; lat < latBands; lat++) {
        for (let lon = 0; lon < lonBands; lon++) {
          let first = (lat * (lonBands + 1)) + lon, second = first + lonBands + 1;
          i.push(first, second, first + 1, second, second + 1, first + 1);
        }
      }
      return { p: new Float32Array(p), uv: new Float32Array(uv), i: new Uint16Array(i) };
    }
  };
  
    class Buffer {
      constructor(type) {
        this.buffer = gl.createBuffer();
        this.bytesPerEl = 1; this.size = 1; this.length = 0; this.type = type;
      }
      destroy() { gl.deleteBuffer(this.buffer); }
    }
  
    class RenderTarget {
      constructor() { this.destroyed = false; this.viewport = null; this.scissors = null; this.readarea = null; }
      setAsRenderTarget() { currentRenderTarget = this; gl.bindFramebuffer(gl.FRAMEBUFFER, this.getFramebuffer()); this.updateViewport(); this.updateDepth(); this.updateScissorsEnabled(); }
      updateScissorsEnabled() { if (this.scissors) gl.enable(gl.SCISSOR_TEST); else gl.disable(gl.SCISSOR_TEST); }
      updateViewport() {
        const a = this.viewport, b = this.scissors;
        if (a) gl.viewport(a.x, a.y, a.w, a.h); else gl.viewport(0, 0, this.width, this.height);
        if (b) gl.scissor(b.x, b.y, b.w, b.h);
      }
      getReadarea() { if (this.readarea) return this.readarea; return { x: 0, y: 0, w: this.width, h: this.height }; }
      updateDepth() {
        if (this.depthTest == "everything" && !this.depthWrite) { gl.disable(gl.DEPTH_TEST); } 
        else { gl.enable(gl.DEPTH_TEST); gl.depthFunc(DepthTests[this.depthTest]); gl.depthMask(this.depthWrite); }
      }
      getAspectRatio() { if (this.width == 0) return 1; return this.width / this.height; }
      destroy() { this.destroyed = true; }
    }
  
    class CanvasRenderTarget extends RenderTarget {
      constructor() { super(); this.reset(); }
      get width() { return canvas.width; }
      get height() { return canvas.height; }
      getFramebuffer() { return null; }
      getMesh() { return null; }
      setDepth(test, write) { this.depthTest = test; this.depthWrite = write; }
      get hasDepthBuffer() { return true; }
      isLoading() { return false; }
      checkIfValid() { return true; }
      reset() { this.depthTest = "closer"; this.depthWrite = true; }
    }
  
    class Texture {
      constructor(target, mesh) {
        this.mesh = mesh; this.target = target; this.texture = gl.createTexture();
        this.width = 0; this.height = 0; this.depthTest = "everything"; this.depthWrite = false;
        this.wrap = gl.CLAMP_TO_EDGE; this.filter = gl.NEAREST; this.mipFilter = gl.NEAREST;
        this.mipEnabled = false; this.anisotropy = 1; this.hasDepthBuffer = false;
        this.update();
      }
      bindTexture() { gl.bindTexture(this.target, this.texture); }
      update() {
        let minFilter = this.filter;
        if (this.mipEnabled) {
          const lookup = [[gl.NEAREST_MIPMAP_NEAREST, gl.NEAREST_MIPMAP_LINEAR], [gl.LINEAR_MIPMAP_NEAREST, gl.LINEAR_MIPMAP_LINEAR]];
          minFilter = lookup[+(this.filter == gl.LINEAR)][+(this.mipFilter == gl.LINEAR)];
        }
        gl.bindTexture(this.target, this.texture);
        gl.texParameteri(this.target, gl.TEXTURE_WRAP_S, this.wrap);
        gl.texParameteri(this.target, gl.TEXTURE_WRAP_T, this.wrap);
        gl.texParameteri(this.target, gl.TEXTURE_MIN_FILTER, minFilter);
        gl.texParameteri(this.target, gl.TEXTURE_MAG_FILTER, this.filter);
      }
      setTextureProps(side, width, height, wrap, filter) {
        const resize = this.width !== width || this.height !== height;
        this.width = width; this.height = height; this.wrap = wrap; this.filter = filter;
        if (resize) { for (const otherSide of this.sides) { if (otherSide !== side) otherSide.resetTexture(width, height); } }
        this.update(); this.maybeRegenMipmap();
        if (ext_af) gl.texParameterf(this.target, ext_af.TEXTURE_MAX_ANISOTROPY_EXT, this.anisotropy);
      }
      setMipmapState(enabled, filter) { this.mipEnabled = enabled; this.mipFilter = filter; this.update(); this.maybeRegenMipmap(); }
      setAnisotropy(value) {
        if (!ext_af) return;
        this.anisotropy = value; gl.bindTexture(this.target, this.texture); this.maybeRegenMipmap();
        gl.texParameterf(this.target, ext_af.TEXTURE_MAX_ANISOTROPY_EXT, value);
      }
      maybeRegenMipmap() { if ((this.mipEnabled || this.anisotropy > 1) && !this.isLoading() && !this.hasFailedToLoad()) gl.generateMipmap(this.target); }
      setDepth(test, write) {
        this.depthTest = test; this.depthWrite = write;
        if (!this.hasDepthBuffer && write) { this.hasDepthBuffer = true; for (let side of this.sides) side.createDepthBuffer(); }
      }
      isLoading() { for (const side of this.sides) { if (side.loading) return true; } return false; }
      hasFailedToLoad() { for (const side of this.sides) { if (side.failedToLoad) return true; } return false; }
      destroy() { gl.deleteTexture(this.texture); for (const side of this.sides) side.destroy(); }
    }
  
    class Texture2D extends Texture {
      constructor(mesh) { super(gl.TEXTURE_2D, mesh); this.main = new TextureSide(this, gl.TEXTURE_2D); this.sides = [this.main]; }
    }
  
    class TextureCube extends Texture {
      constructor(mesh) {
        super(gl.TEXTURE_CUBE_MAP, mesh);
        this.xpos = new TextureSide(this, gl.TEXTURE_CUBE_MAP_POSITIVE_X); this.xneg = new TextureSide(this, gl.TEXTURE_CUBE_MAP_NEGATIVE_X);
        this.ypos = new TextureSide(this, gl.TEXTURE_CUBE_MAP_POSITIVE_Y); this.yneg = new TextureSide(this, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y);
        this.zpos = new TextureSide(this, gl.TEXTURE_CUBE_MAP_POSITIVE_Z); this.zneg = new TextureSide(this, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z);
        this.sides = [this.xpos, this.xneg, this.ypos, this.yneg, this.zpos, this.zneg];
      }
    }
  
    class TextureSide extends RenderTarget {
      constructor(shared, target) { super(); this.shared = shared; this.target = target; this.depthTexture = null; this.framebuffer = null; this.loading = false; this.failedToLoad = false; this.uninitialized = true; }
      resetTexture(width, height) {
        this.uninitialized = false;
        gl.texImage2D(this.target, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        if (this.depthTexture) { gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthTexture); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height); }
        if (currentRenderTarget == this) this.updateViewport();
      }
      setTexture(data, width, height, wrap, filter) {
        this.uninitialized = false; this.loading = false; this.failedToLoad = false; this.shared.bindTexture();
        if (data instanceof HTMLImageElement || data instanceof HTMLCanvasElement) { gl.texImage2D(this.target, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data); } 
        else { gl.texImage2D(this.target, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data); }
        this.shared.setTextureProps(this, width, height, wrap, filter);
        if (this.depthTexture) { gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthTexture); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height); }
        if (currentRenderTarget == this) this.updateViewport();
      }
      getFramebuffer() {
        if (this.framebuffer) return this.framebuffer;
        this.framebuffer = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, this.target, this.shared.texture, 0);
        return this.framebuffer;
      }
      createDepthBuffer() {
        const framebuffer = this.getFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        this.depthTexture = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthTexture);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, this.width, this.height);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depthTexture);
      }
      get depthTest() { return this.shared.depthTest; } get depthWrite() { return this.shared.depthWrite; }
      get width() { return this.shared.width; } get height() { return this.shared.height; }
      get hasDepthBuffer() { return this.shared.hasDepthBuffer; }
      setDepth(test, write) { this.shared.setDepth(test, write); }
      getMesh() { return this.shared.mesh; }
      checkIfValid() { return !(this.uninitialized || this.destroyed); }
      destroy() { if (this.depthTexture) gl.deleteRenderbuffer(this.depthTexture); if (this.framebuffer) gl.deleteFramebuffer(this.framebuffer); super.destroy(); }
    }
  
    class Mesh {
      constructor(name) {
        this.name = name; this.buffers = {}; this.myBuffers = {}; this.data = {}; this.myData = {};
        this.uploadOffset = -1; this.uploadUsage = gl.STATIC_DRAW; this.dependants = new Set(); this.dependencies = new Set();
      }
      update() {
        const buffers = {}, data = {};
        for (const otherMesh of this.dependencies) { Object.assign(buffers, otherMesh.buffers); Object.assign(data, otherMesh.data); }
        this.buffers = Object.assign(buffers, this.myBuffers); this.data = Object.assign(data, this.myData);
        for (const otherMesh of this.dependants) { otherMesh.update(); }
      }
      dependsOn(mesh) {
        if (mesh == this) return true;
        for (const otherMesh of this.dependencies) { if (otherMesh.dependsOn(mesh)) return true; }
        return false;
      }
      checkIfValid() {
        if (currentRenderTarget.getMesh() == this) return false;
        if (!this.buffers.position) return false;
        let length = -1, lengthIns = -1;
        for (const name in this.buffers) {
          const buffer = this.buffers[name];
          if (buffer.type == 0) { if (length == -1) length = buffer.length; else if (length !== buffer.length) return false; } 
          else if (buffer.type == 1) { if (lengthIns == -1) lengthIns = buffer.length; else if (lengthIns !== buffer.length) return false; }
        }
        if (length == -1) return false;
        return true;
      }
      estimateListVRAM() { let sum = 0; for (const name in this.myBuffers) { const buffer = this.myBuffers[name]; sum += buffer.length * buffer.size * buffer.bytesPerEl; } return sum; }
      estimateTextureVRAM() { const texture = this.myData.texture; if (!texture) return 0; let pixelsVRAM = texture.width * texture.height * 4; if (texture.hasDepthBuffer) pixelsVRAM *= 2; if (texture instanceof TextureCube) pixelsVRAM *= 6; return pixelsVRAM; }
      estimateVRAM() { return this.estimateListVRAM() + this.estimateTextureVRAM(); }
      destroy() {
        for (let name in this.myBuffers) { this.myBuffers[name].destroy(); }
        this.myData.texture?.destroy();
        for (const otherMesh of this.dependants) { otherMesh.dependencies.delete(this); }
        for (const otherMesh of this.dependencies) { otherMesh.dependants.delete(this); }
        for (const otherMesh of this.dependants) { otherMesh.update(); }
      }
    }
  
    const MeshPropFns = {
      "inherits from": (mesh) => Array.from(mesh.dependencies).map((m) => m.name).join(","),
      "is inherited by": (mesh) => Array.from(mesh.dependants).map((m) => m.name).join(","),
      "is valid for drawing": (mesh) => mesh.checkIfValid(),
      "has vertex indices": (mesh) => !!mesh.buffers.indices,
      "has positions": (mesh) => !!mesh.buffers.position,
      "has colors": (mesh) => !!mesh.buffers.colors,
      "has texture coordinates": (mesh) => !!mesh.buffers.texCoords,
      "has bone indices/weights": (mesh) => !!mesh.buffers.boneIndices,
      "has bones": (mesh) => !!mesh.data.bonesDiff,
      "has instanced positions": (mesh) => !!mesh.buffers.instanceTransforms,
      "has instanced colors": (mesh) => !!mesh.buffers.instanceColors,
      "has instanced uvs": (mesh) => !!mesh.buffers.instanceUVOffsets,
      "has texture": (mesh) => !!mesh.data.texture,
      "texture width": (mesh) => mesh.data.texture?.width,
      "texture height": (mesh) => mesh.data.texture?.height,
      "texture stores depth": (mesh) => mesh.data.texture?.hasDepthBuffer,
      "texture depth write": (mesh) => mesh.data.texture?.depthWrite,
      "texture depth test": (mesh) => mesh.data.texture?.depthTest,
      "texture is 2D": (mesh) => mesh.data.texture instanceof Texture2D,
      "texture is cube": (mesh) => mesh.data.texture instanceof TextureCube,
      "texture is loading": (mesh) => mesh.data.texture?.isLoading?.(),
      "texture has failed to load": (mesh) => mesh.data.texture?.hasFailedToLoad?.(),
      "primitive type": (mesh) => mesh.data.primitivesName ?? "triangles",
      "blending type": (mesh) => mesh.data.blending ?? "default",
      "culling type": (mesh) => mesh.data.culling ?? "nothing",
      "alpha threshold": (mesh) => mesh.data.alphaTest ?? 0,
      "makes opaque": (mesh) => !!mesh.data.makeOpaque,
      "has billboarding": (mesh) => !!mesh.data.billboarding,
      "has vertex draw range": (mesh) => !!mesh.data.drawRange,
      "vertex draw range start": (mesh) => mesh.data.drawRange && mesh.data.drawRange[0] + 1,
      "vertex draw range end": (mesh) => mesh.data.drawRange && mesh.data.drawRange[0] + mesh.data.drawRange[1],
      "vertex draw range length": (mesh) => mesh.data.drawRange && mesh.data.drawRange[1],
      "instance draw limit": (mesh) => mesh.data.maxInstances ?? Infinity,
      "partial list update enabled": (mesh) => mesh.uploadOffset >= 0,
      "estimate own VRAM usage": (mesh) => mesh.estimateVRAM(),
      "estimate own list VRAM usage": (mesh) => mesh.estimateListVRAM(),
      "estimate own texture VRAM usage": (mesh) => mesh.estimateTextureVRAM(),
    };
  
    let workerSrc = `
    class OffModelImporter {
      constructor(dataRaw) {
        const dataStr = dataRaw.map(str => str.split("#")[0].replaceAll("\t", " ").trim()).filter(str => str.length);
        const dataArr = dataStr.map(str => str.split(" ").filter(e => e));
        let i = 0; if (dataStr[i].endsWith("OFF")) i++; if (dataArr[i].length !== 3) return false;
        const [vertexCount, faceCount, edgeCount] = dataArr[i].map(n => +n); i++;
        const vertices = dataArr.slice(i, i+vertexCount); i += vertexCount;
        const faces = dataArr.slice(i, i+faceCount); i += faceCount;
        this.vertices = vertices; this.output = { xyz: [], rgba: [] }
        for(const face of faces) { const nVerts = +face[0]; this.addPoly(face.slice(1, 1+nVerts), face.slice(1+nVerts)); }
        let hasColor = false; const rgba = this.output.rgba;
        for(let i=0; i<rgba.length; i++) { if (rgba[i] < 1) { hasColor = true; break; } }
        if (!hasColor) delete this.output.rgba;
      }
      addPoly(vs, fallback) {
        fallback = fallback.map(this.parseColor); if (fallback.length == 3) fallback.push(1);
        for(let i=2; i<vs.length; i++) { this.addVertex(vs[  0], fallback); this.addVertex(vs[i-1], fallback); this.addVertex(vs[  i], fallback); }
      }
      addVertex(idx, fallback) {
        const v = this.vertices[idx];
        this.output.xyz.push(+v[0], +v[1], +v[2]);
        this.output.rgba.push(this.parseColor(v[3]) ?? fallback[0] ?? 1, this.parseColor(v[4]) ?? fallback[1] ?? 1, this.parseColor(v[5]) ?? fallback[2] ?? 1, this.parseColor(v[6]) ?? fallback[3] ?? 1);
      }
      parseColor(string) { const number = +string; if (!Number.isFinite(number)) return undefined; if (string.indexOf(".") == -1) return number / 255; return number; }
    }
    class ObjModelImporter {
      constructor(dataRaw) {
        const dataStr = dataRaw.map(str => str.replaceAll("\t", " ").trim()).filter(str => str.length && str[0] !== "#");
        const dataArr = dataStr.map(str => str.split(" ").filter(e => e));
        const materials = {" ": [1,1,1,1]}; let materialLast = " "; let materialUsed = " ";
        const vertPos = this.vertPos = [null]; const vertUV = this.vertUV = [null];
        this.output = { xyz: [], rgba: [], uv: [] }
        for(let i=0; i<dataArr.length; i++) {
          const arr = dataArr[i];
          if (arr[0] == "v") vertPos.push(arr.slice(1).map(Number));
          if (arr[0] == "vt") vertUV.push([+arr[1], +arr[2]]);
          if (arr[0] == "f") this.addPoly(arr.slice(1).map(e => e.split("/").map(Number)), materials[materialUsed]);
          if (arr[0] == "usemtl") materialUsed = materials[arr[1]] ? arr[1] : " ";
          if (arr[0] == "newmtl") { materialLast = arr[1]; materials[materialLast] = [1,1,1,1]; }
          if (arr[0] == "Kd") { const color = materials[materialLast]; color[0] = +arr[1]; color[1] = +arr[2]; color[2] = +arr[3]; }
          if (arr[0] == "d") materials[materialLast][3] = +arr[1];
          if (arr[0] == "Tr") materials[materialLast][3] = 1 - arr[1];
        }
        if (this.output.uv.length/2 !== this.output.rgba.length/4) this.output.uv = null;
      }
      addPoly(vs, fallback) {
        for(let i=2; i<vs.length; i++) { this.addVertex(vs[  0][0], vs[  0][1], fallback); this.addVertex(vs[i-1][0], vs[i-1][1], fallback); this.addVertex(vs[  i][0], vs[  i][1], fallback); }
      }
      addVertex(idx, idxUV, fallback) {
        const v = this.vertPos[idx>0 ? idx : this.vertPos.length+idx];
        this.output.xyz.push(v[0], v[1], v[2]);
        this.output.rgba.push(v[3] ?? fallback[0] ?? 1, v[4] ?? fallback[1] ?? 1, v[5] ?? fallback[2] ?? 1, v[6] ?? fallback[3] ?? 1);
        if (idxUV !== undefined) { const u = this.vertUV[idxUV>0 ? idxUV : this.vertUV.length+idxUV]; this.output.uv.push(u[0], 1-u[1]); }
      }
    }
    onmessage = (evt) => {
      const {type, array, importMatrix} = evt.data;
      let output = null;
      try {
        let model = null;
        if (type == "obj mtl") model = new ObjModelImporter(array);
        if (type == "off") model = new OffModelImporter(array);
        if (!model) return;
        output = model.output;
        if (output.xyz) {
          const xyz = output.xyz; let needsScaling = false;
          for(let i=0; i<16; i++) { if (importMatrix[i] !== +(i%5 == 0)) needsScaling = true; }
          const a = importMatrix;
          if (needsScaling) {
            for(let i=0; i<xyz.length; i+=3) {
              const x = xyz[i], y = xyz[i+1], z = xyz[i+2];
              xyz[i  ] = x * a[0] + y * a[4] + z * a[8] + a[12];
              xyz[i+1] = x * a[1] + y * a[5] + z * a[9] + a[13];
              xyz[i+2] = x * a[2] + y * a[6] + z * a[10] + a[14];
            }
          }
        }
        if (output.rgba) { const rgba = output.rgba; for(let i=0; i<rgba.length; i++) rgba[i] *= 255; }
      } catch(e) { output = null; console.error(e); }
      postMessage(output);
    }
    `;
  
    class ModelDecoder {
      constructor() {
        this.worker = null; this.timeout = -1; this.resolveFn = null; this.queue = []; this.timeLimit = 90000; this.boundHandle = this.handle.bind(this);
      }
      decode(type, array, importMatrix) {
        return new Promise((resolve) => { this.queue.push({ data: { type, array, importMatrix }, resolve }); this.tryMoveQueue(); });
      }
      tryMoveQueue() {
        if (this.busy) return; if (this.queue.length == 0) return;
        if (!this.worker) { this.worker = new Worker(`data:text/javascript;base64,${btoa(workerSrc)}`); this.worker.addEventListener("message", this.boundHandle); }
        const { data, resolve } = this.queue.shift();
        this.resolveFn = resolve; this.busy = true; this.worker.postMessage(data);
        this.timeout = setTimeout(this.restartWorker.bind(this), this.timeLimit);
      }
      handle(output) {
        if (this.timeout !== -1) { clearTimeout(this.timeout); this.timeout = -1; }
        this.resolveFn(output.data); this.resolveFn = null; this.busy = false; this.tryMoveQueue();
      }
      clear() { for (const { resolve } of this.queue) resolve(null); this.queue = []; }
      destroy() { this.clear(); this.destroyWorker(); }
      destroyWorker() {
        if (this.resolveFn) { this.resolveFn(null); this.resolveFn = null; }
        if (this.worker) { this.worker.removeEventListener("message", this.boundHandle); this.worker.terminate(); this.worker = null; this.busy = false; }
      }
      restartWorker() { console.warn("Simple3D: Worker took too long to decode the model and was terminated"); this.destroyWorker(); this.tryMoveQueue(); }
    }
  
    class SimpleSkin extends Scratch.vm.renderer.exports.Skin {
      constructor(id, renderer) {
        super(id, renderer);
        const gl = renderer.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        this._texture = texture;
        this._nativeSize = renderer.getNativeSize();
        this._boundOnNativeSizeChanged = this.onNativeSizeChanged.bind(this);
        this._rotationCenter = [this._nativeSize[0] / 2, this._nativeSize[1] / 2];
        renderer.on("NativeSizeChanged", this._boundOnNativeSizeChanged);
        this.resizeCanvas();
      }
      dispose() {
        renderer.removeListener("NativeSizeChanged", this._boundOnNativeSizeChanged);
        if (this._texture) { this._renderer.gl.deleteTexture(this._texture); this._texture = null; }
        super.dispose();
      }
      get size() { return this._nativeSize; }
      getTexture(scale) { return this._texture || super.getTexture(); }
      updateContent() {
        const gl = this._renderer.gl;
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        this._silhouette.update(canvas);
        this.emitWasAltered();
      }
      resizeCanvas() {
        if (renderer.useHighQualityRender) { canvas.width = renderer.canvas.width; canvas.height = renderer.canvas.height; } 
        else { canvas.width = this._nativeSize[0]; canvas.height = this._nativeSize[1]; }
        if (currentRenderTarget == canvasRenderTarget) currentRenderTarget.updateViewport();
        runtime.startHats(`${extensionId}_whenCanvasResized`);
        this.updateContent();
      }
      onNativeSizeChanged(event) {
        this._nativeSize = event.newSize;
        this._rotationCenter = [this._nativeSize[0] / 2, this._nativeSize[1] / 2];
        this.resizeCanvas();
      }
    }
  
    function addSimple3DLayer(publicApi) {
      let index = renderer._groupOrdering.indexOf("video");
      renderer._groupOrdering.splice(index + 1, 0, "simple3D");
      renderer._layerGroups["simple3D"] = { groupIndex: 0, drawListOffset: renderer._layerGroups["video"].drawListOffset };
      for (let i = 0; i < renderer._groupOrdering.length; i++) { renderer._layerGroups[renderer._groupOrdering[i]].groupIndex = i; }
      skinId = renderer._nextSkinId++;
      const skin = new SimpleSkin(skinId, renderer);
      renderer._allSkins[skinId] = skin;
      drawableId = renderer.createDrawable("simple3D");
      const drawable = renderer._allDrawables[drawableId];
      renderer.updateDrawableSkinId(drawableId, skinId);
      if (renderer.markDrawableAsNoninteractive) { renderer.markDrawableAsNoninteractive(drawableId); }
      drawable.setHighQuality = function (...args) { Object.getPrototypeOf(this).setHighQuality(...args); this.skin.resizeCanvas(); };
      drawable.customDrawableName = "Simple3D Layer";
      if (!publicApi.redraw) {
        const drawOriginal = renderer.draw;
        renderer.draw = function () { if (this.dirty && publicApi.redraw) publicApi.redraw(); drawOriginal.call(this); };
      }
      publicApi.redraw = function () { if (canvasDirty) { skin.updateContent(canvas); canvasDirty = false; } };
      publicApi.redraw();
    }
  
    function removeSimple3DLayer() {
      renderer.destroyDrawable(drawableId, "simple3D"); renderer.destroySkin(skinId);
      const index = renderer._groupOrdering.indexOf("simple3D");
      if (index == -1) return;
      const start = renderer._layerGroups["simple3D"].drawListOffset;
      const end = renderer._layerGroups[renderer._groupOrdering[index + 1]].drawListOffset;
      if (start !== end) return;
      renderer._groupOrdering.splice(index, 1);
      delete renderer._layerGroups["simple3D"];
      for (let i = 0; i < renderer._groupOrdering.length; i++) { renderer._layerGroups[renderer._groupOrdering[i]].groupIndex = i; }
      publicApi.redraw = null;
    }
  
    let vshSrc = `
  #ifdef MSAA_CENTROID
  #define INTERPOLATION centroid
  #endif
  #ifdef MSAA_SAMPLE
  #extension GL_OES_shader_multisample_interpolation : require
  #define INTERPOLATION sample
  #endif
  #ifndef INTERPOLATION
  #define INTERPOLATION
  #endif
  
  precision highp float;
  
  in vec4 a_position;
  #ifdef COLORS
  in vec4 a_color;
  #endif
  #ifdef TEXTURES
  #if TEXTURES == 2
  in vec2 a_uv;
  #elif TEXTURES == 3
  in vec3 a_uv;
  #endif
  #endif
  #ifdef SKINNING
  #if SKINNING == 1
  in float a_index;
  #elif SKINNING == 2
  in vec2 a_index;
  in vec2 a_weight;
  #elif SKINNING == 3
  in vec3 a_index;
  in vec3 a_weight;
  #elif SKINNING == 4
  in vec4 a_index;
  in vec4 a_weight;
  #endif
  #endif
  #ifdef INSTANCE_POS
  in vec3 a_instanceTransform;
  #endif
  #ifdef INSTANCE_POS_SCALE
  in vec4 a_instanceTransform;
  #endif
  #ifdef INSTANCE_MATRIX
  in mat4 a_instanceTransform;
  #endif
  #ifdef INSTANCE_COLOR
  in vec4 a_instanceColor;
  #endif
  #ifdef INSTANCE_UV
  in vec2 a_instanceUV;
  #endif
  #ifdef INSTANCE_UVS
  in vec4 a_instanceUV;
  #endif
  
  INTERPOLATION out vec4 v_color;
  #ifdef TEXTURES
  #if TEXTURES == 2
  INTERPOLATION out vec2 v_uv;
  #elif TEXTURES == 3
  INTERPOLATION out vec3 v_uv;
  #endif
  #endif
  INTERPOLATION out vec3 v_viewpos;
  INTERPOLATION out vec3 v_worldpos; // 🌟 传给光影用的世界坐标
  uniform mat4 u_projection;
  uniform mat4 u_view;
  uniform mat4 u_model;
  #ifdef BONE_COUNT
  uniform mat4 u_bones[BONE_COUNT];
  #endif
  uniform vec2 u_uvOffset;
  uniform vec3 u_fog_position;
  
  void main() {
    vec4 pos = a_position;
  #ifdef SKINNING
  #if SKINNING == 1
    pos = u_bones[int(a_index)] * a_position;
  #elif SKINNING == 2
    pos = u_bones[int(a_index.x)] * a_position * a_weight.x +
          u_bones[int(a_index.y)] * a_position * a_weight.y;
  #elif SKINNING == 3
    pos = u_bones[int(a_index.x)] * a_position * a_weight.x +
          u_bones[int(a_index.y)] * a_position * a_weight.y +
          u_bones[int(a_index.z)] * a_position * a_weight.z;
  #elif SKINNING == 4
    pos = u_bones[int(a_index.x)] * a_position * a_weight.x +
          u_bones[int(a_index.y)] * a_position * a_weight.y +
          u_bones[int(a_index.z)] * a_position * a_weight.z +
          u_bones[int(a_index.w)] * a_position * a_weight.w;
  #endif
  #endif
  #ifdef FOG_IN_MODEL_SPACE
    v_viewpos = pos.xyz;
  #endif
  #ifdef INSTANCING
    pos = u_model * pos;
  #endif
  #ifdef INSTANCE_POS_SCALE
    pos.xyz *= a_instanceTransform.w;
  #endif
  #ifdef BILLBOARD
    vec4 pos2 = pos;
    pos = vec4(0,0,0,1);
  #endif
  #if defined(INSTANCE_POS) || defined(INSTANCE_POS_SCALE)
    pos.xyz += a_instanceTransform.xyz;
  #endif
  #ifdef INSTANCE_MATRIX
    pos = a_instanceTransform * pos;
  #endif
  #ifndef INSTANCING
    pos = u_model * pos;
  #endif
    v_worldpos = pos.xyz; // 🌟 抓取光影坐标
    vec4 view = u_view * pos;
  #ifdef BILLBOARD
  #ifdef INSTANCE_MATRIX
    pos2 = a_instanceTransform * vec4(pos2.xyz, 0);
  #endif
  #ifndef INSTANCING
    pos2 = u_model * vec4(pos2.xyz, 0);
  #endif
    view += pos2;
  #ifdef FOG_IN_WORLD_SPACE
    v_viewpos = vec4(inverse(u_view) * view).xyz;
  #endif
  #else
  #ifdef FOG_IN_WORLD_SPACE
    v_viewpos = pos.xyz;
  #endif
  #endif
  #ifdef TEXTURES
  #if TEXTURES == 2
    vec2 uv = a_uv;
  #ifdef INSTANCE_UVS
    uv *= a_instanceUV.zw;
    uv += a_instanceUV.xy;
  #endif
  #ifdef INSTANCE_UV
    uv += a_instanceUV.xy;
  #endif
  #ifdef UV_OFFSET
    uv += u_uvOffset;
  #endif
  #elif TEXTURES == 3
    vec3 uv = a_uv;
  #endif
  #endif
    gl_Position = u_projection * view;
  #ifdef COLORS
    vec4 color = a_color;
  #else
    vec4 color = vec4(1);
  #endif
  #ifdef INSTANCE_COLOR
    color *= a_instanceColor;
  #endif
    v_color = color;
  #ifdef TEXTURES
    v_uv = uv;
  #endif
  #ifdef FOG_IN_VIEW_SPACE
    v_viewpos = view.xyz;
  #endif
  #ifdef FOG_POS
    v_viewpos -= u_fog_position;
  #endif
  }
  `;
    let fshSrc = `
  #ifdef MSAA_CENTROID
  #define INTERPOLATION centroid
  #endif
  #ifdef MSAA_SAMPLE
  #extension GL_OES_shader_multisample_interpolation : require
  #define INTERPOLATION sample
  #endif
  #ifndef INTERPOLATION
  #define INTERPOLATION
  #endif
  
  precision mediump float;
  
  INTERPOLATION in vec4 v_color;
  #ifdef TEXTURES
  #if TEXTURES == 2
  INTERPOLATION in vec2 v_uv;
  #elif TEXTURES == 3
  INTERPOLATION in vec3 v_uv;
  #endif
  #endif
  INTERPOLATION in vec3 v_viewpos;
  INTERPOLATION in vec3 v_worldpos; // 🌟 接收世界坐标
  out vec4 outColor;
  
  #ifdef TEXTURES
  #if TEXTURES == 2
  uniform sampler2D u_texture;
  #elif TEXTURES == 3
  uniform samplerCube u_texture;
  #endif
  #endif
  uniform vec4 u_color_mul;
  uniform vec4 u_color_add;
  uniform vec3 u_fog_color;
  uniform vec2 u_fog_dist;
  uniform float u_alpha_threshold;
  uniform float u_use_lighting;
  uniform vec3 u_light_dir;
  uniform vec3 u_light_color;
  uniform vec3 u_ambient_color;
  void main() {
  #ifdef TEXTURES
    vec4 color = texture(u_texture, v_uv);
    color.rgb /= color.a;
  #else
    vec4 color = vec4(1);
  #endif
  #if defined(COLORS) || defined(INSTANCE_COLOR)
    color = color * v_color;
  #endif
  #ifdef ALPHATEST
    if (color.a <= u_alpha_threshold) discard;
  #endif
  #ifdef MAKE_OPAQUE
    color.a = 1.0;
  #endif
  // 🌟 核心魔法：硬件级实时光影解算 (Flat Shading)
  if (u_use_lighting > 0.5) {
      vec3 dx = dFdx(v_worldpos);
      vec3 dy = dFdy(v_worldpos);
      vec3 normDir = cross(dx, dy);
      float len = length(normDir);
      vec3 normal = len > 0.00001 ? (normDir / len) : vec3(0.0, 1.0, 0.0);
      
      // 💡 终极抗闪烁锁：体素法线强制对齐 (Voxel Normal Snapping)
      // 无论视角怎么变，强制把法线锁定在物理轴上，彻底干掉视差带来的颜色漂移！
      vec3 absN = abs(normal);
      if (absN.x > absN.y && absN.x > absN.z) { 
          normal = vec3(sign(normal.x), 0.0, 0.0); 
      } else if (absN.y > absN.x && absN.y > absN.z) { 
          normal = vec3(0.0, sign(normal.y), 0.0); 
      } else { 
          normal = vec3(0.0, 0.0, sign(normal.z)); 
      }
      
      float diff = max(dot(normal, normalize(u_light_dir)), 0.0);
      vec3 lighting = u_ambient_color + (u_light_color * diff);
      color.rgb *= lighting; 
  }
    color = color * u_color_mul + u_color_add;
  #ifdef FOG
    float fog = (length(v_viewpos) - u_fog_dist.x) / u_fog_dist.y;
    color.rgb = mix(color.rgb, u_fog_color, clamp(fog, 0.0, 1.0));
  #endif
    color.a = clamp(color.a, 0.0, 1.0);
    color.rgb *= color.a;
    outColor = color;
  }
  `;
    function compileProgram(flags) {
      const defines = "#version 300 es\n" + flags.map((flag) => `#define ${flag}\n`).join("");
      const vsh = gl.createShader(gl.VERTEX_SHADER);
      const fsh = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(vsh, defines + vshSrc);
      gl.shaderSource(fsh, defines + fshSrc);
      gl.compileShader(vsh);
      gl.compileShader(fsh);
      const program = gl.createProgram();
      gl.attachShader(program, vsh);
      gl.attachShader(program, fsh);
      gl.linkProgram(program);
      const success = gl.getProgramParameter(program, gl.LINK_STATUS);
      gl.deleteShader(vsh);
      gl.deleteShader(fsh);
      if (!success) { gl.deleteProgram(program); return {}; }
      gl.useProgram(program);
      const aloc = {};
      const numAttribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
      for (let i = 0; i < numAttribs; i++) {
        const info = gl.getActiveAttrib(program, i);
        aloc[info.name.split("[")[0]] = gl.getAttribLocation(program, info.name);
      }
      const uloc = {};
      const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < numUniforms; i++) {
        const info = gl.getActiveUniform(program, i);
        uloc[info.name.split("[")[0]] = gl.getUniformLocation(program, info.name);
      }
      return { program, aloc, uloc };
    }
    class ProgramManager {
      constructor() { this.programs = {}; }
      get(flags) {
        const key = flags.join("-");
        let program = this.programs[key];
        if (program) return program;
        program = compileProgram(flags);
        this.programs[key] = program;
        return program;
      }
      clear() {
        for (const key in this.programs) { if (this.programs[key].program) { gl.deleteProgram(this.programs[key].program); } }
        this.programs = {};
      }
    }
    function getDefaultTexture() {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      const image = new Image();
      image.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAABg2lDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw1AUhU9TpUUqDnYQcchQneyiIo61FYpQIdQKrTqYvPQPmjQkKS6OgmvBwZ/FqoOLs64OroIg+APi7OCk6CIl3pcUWsT44PI+znvncN99gNCqMc3qSwCabpvZdFLMF1bF0CsEhAGqmMwsY16SMvBdX/cI8P0uzrP87/25BtWixYCASJxghmkTbxDPbtoG533iKKvIKvE58aRJDRI/cl3x+I1z2WWBZ0bNXDZFHCUWyz2s9DCrmBrxDHFM1XTKF/Ieq5y3OGu1Buv0yV8YKeory1ynGkMai1iCBBEKGqiiBhtx2nVSLGTpPOnjH3X9ErkUclXByLGAOjTIrh/8D37P1ipNT3lJkSTQ/+I4H+NAaBdoNx3n+9hx2idA8Bm40rv+eguY+yS92dViR8DQNnBx3dWUPeByBxh5MmRTdqUglVAqAe9n9E0FYPgWGFjz5tY5x+kDkKNZZW6Ag0NgokzZ6z7vDvfO7d87nfn9ACRZcoedT/mXAAAAGFBMVEVtbW11dXVtbf+EhIT/bW2goKBt/21t//8Qh6V7AAAACXBIWXMAABhMAAAYdAGfqEAgAAAAB3RJTUUH6AIIAA4YBFj9GAAAABl0RVh0Q29tbWVudABDcmVhdGVkIHdpdGggR0lNUFeBDhcAAABjSURBVAjXPctBDkAwFIThqdey91ygnIAoa9EzcIBGLyDS69MW/26+ZIAvZYwhZkbpNy/saKGOyUjmFeQ2J5Z+SUJNFi+TfK+/uKJCtENbhT2gYO7UNT+ie03nfoLqV4os4X/dFf0TKILDS0AAAAAASUVORK5CYII=";
      image.onload = function () { gl.bindTexture(gl.TEXTURE_2D, texture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image); };
      return texture;
    }
    function requireNonPackagedRuntime(blockName) {
      if (runtime.isPackaged) { alert(`To use the Simple3D ${blockName} block, the creator of the packaged project must uncheck "Remove raw asset data after loading to save RAM" under advanced settings in the packager.`); return false; }
      return true;
    }
    function compact(target, names, typedArray, scale = 1) {
      const lists = names.map((name) => target.lookupVariableByNameAndType(name, "list"));
      if (lists.includes(null)) return null;
      const targetLength = lists[0].value.length;
      const listCount = lists.length;
      if (lists.find((list) => list.value.length !== targetLength)) return null;
      const value = new typedArray(targetLength * listCount);
      if (scale !== 1) {
        if (listCount == 1) { const list0 = lists[0].value; for (let i = 0; i < targetLength; i++) { value[i] = list0[i] * scale; } } 
        else if (listCount == 2) { const list0 = lists[0].value; const list1 = lists[1].value; for (let i = 0, j = 0; i < targetLength; i++, j += 2) { value[j] = list0[i] * scale; value[j + 1] = list1[i] * scale; } } 
        else if (listCount == 3) { const list0 = lists[0].value; const list1 = lists[1].value; const list2 = lists[2].value; for (let i = 0, j = 0; i < targetLength; i++, j += 3) { value[j] = list0[i] * scale; value[j + 1] = list1[i] * scale; value[j + 2] = list2[i] * scale; } } 
        else if (listCount == 4) { const list0 = lists[0].value; const list1 = lists[1].value; const list2 = lists[2].value; const list3 = lists[3].value; for (let i = 0, j = 0; i < targetLength; i++, j += 4) { value[j] = list0[i] * scale; value[j + 1] = list1[i] * scale; value[j + 2] = list2[i] * scale; value[j + 3] = list3[i] * scale; } } 
        else { for (let i = 0, j = 0; i < targetLength; i++) { for (let k = 0; k < listCount; k++) { value[j++] = lists[k].value[i] * scale; } } }
      } else {
        if (listCount == 1) { const list0 = lists[0].value; for (let i = 0; i < targetLength; i++) { value[i] = +list0[i]; } } 
        else if (listCount == 2) { const list0 = lists[0].value; const list1 = lists[1].value; for (let i = 0, j = 0; i < targetLength; i++, j += 2) { value[j] = +list0[i]; value[j + 1] = +list1[i]; } } 
        else if (listCount == 3) { const list0 = lists[0].value; const list1 = lists[1].value; const list2 = lists[2].value; for (let i = 0, j = 0; i < targetLength; i++, j += 3) { value[j] = +list0[i]; value[j + 1] = +list1[i]; value[j + 2] = +list2[i]; } } 
        else if (listCount == 4) { const list0 = lists[0].value; const list1 = lists[1].value; const list2 = lists[2].value; const list3 = lists[3].value; for (let i = 0, j = 0; i < targetLength; i++, j += 4) { value[j] = +list0[i]; value[j + 1] = +list1[i]; value[j + 2] = +list2[i]; value[j + 3] = +list3[i]; } } 
        else { for (let i = 0, j = 0; i < targetLength; i++) { for (let k = 0; k < listCount; k++) { value[j++] = +lists[k].value[i]; } } }
      }
      return value;
    }
    function compactIndices(target, name) {
      const list = target.lookupVariableByNameAndType(name, "list");
      if (!list) return null;
      let maxNum = 0;
      let value = [];
      let restarts = [];
      for (let i = 0; i < list.value.length; i++) {
        let num = Math.floor(Cast.toNumber(list.value[i]) - 1);
        if (num < 0) { restarts.push(i); } else if (num > maxNum) { maxNum = num; }
        value.push(num);
      }
      let restartIndex, typedArray;
      if (maxNum > 4294967294) { alert(`Simple3D error: Found vertex index ${maxNum}. The maximum supported value is 4294967295.`); }
      if (maxNum > 65534) { typedArray = Uint32Array; restartIndex = 4294967295; } 
      else if (maxNum > 254) { typedArray = Uint16Array; restartIndex = 65535; } 
      else { typedArray = Uint8Array; restartIndex = 255; }
      for (let i of restarts) { value[i] = restartIndex; }
      return new typedArray(value);
    }
    function uploadBuffer(mesh, name, value, size, type, target = gl.ARRAY_BUFFER) {
      if (!mesh || !value) return;
      if (value.length % size !== 0) return;
      if (mesh.uploadOffset < 0) {
        const buffer = mesh.myBuffers[name] ?? (mesh.myBuffers[name] = new Buffer(type));
        gl.bindBuffer(target, buffer.buffer);
        gl.bufferData(target, value, mesh.uploadUsage);
        buffer.size = size; buffer.length = value.length / size; buffer.bytesPerEl = value.BYTES_PER_ELEMENT;
        mesh.update();
      } else {
        const buffer = mesh.myBuffers[name];
        if (!buffer || buffer.size !== size || mesh.uploadOffset * size + value.length > buffer.length * size) return;
        gl.bindBuffer(target, buffer.buffer);
        gl.bufferSubData(target, mesh.uploadOffset * size * value.BYTES_PER_ELEMENT, value);
      }
    }
    function chunkArray(array, size) {
      const chunkedArray = [];
      for (let i = 0; i < array.length; i += size) { chunkedArray.push(array.slice(i, i + size)); }
      return chunkedArray;
    }
  
    // === 这些对象必须保留英文 Key 以维持与着色器的映射，但我们在下方的 menu 配置中进行了汉化替换 ===
    const Blendings = {
      "overwrite color (fastest for opaque)": [false],
      "default": [true, gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.FUNC_ADD],
      "default behind": [true, gl.ONE_MINUS_DST_ALPHA, gl.ONE, gl.ONE_MINUS_DST_ALPHA, gl.ONE, gl.FUNC_ADD],
      "additive": [true, gl.ONE, gl.ONE, gl.ZERO, gl.ONE, gl.FUNC_ADD],
      "subtractive": [true, gl.ONE, gl.ONE, gl.ZERO, gl.ONE, gl.FUNC_REVERSE_SUBTRACT],
      "multiply": [true, gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.FUNC_ADD],
      "invert": [true, gl.ONE_MINUS_DST_COLOR, gl.ONE_MINUS_SRC_COLOR, gl.ZERO, gl.ONE, gl.FUNC_ADD],
      "invisible": [true, gl.ZERO, gl.ONE, gl.ZERO, gl.ONE, gl.FUNC_ADD],
      "mask": [true, gl.ZERO, gl.SRC_ALPHA, gl.ZERO, gl.SRC_ALPHA, gl.FUNC_ADD],
      "erase": [true, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA, gl.FUNC_ADD],
    };
    const Cullings = { "nothing": [false], "back faces": [true, gl.BACK], "front faces": [true, gl.FRONT] };
    const DepthTests = { "nothing": gl.NEVER, "closer": gl.LESS, "same": gl.EQUAL, "further": gl.GREATER, "closer or same": gl.LEQUAL, "further or same": gl.GEQUAL, "not same": gl.NOTEQUAL, "everything": gl.ALWAYS };
    const Primitives = { "points": gl.POINTS, "lines": gl.LINES, "line loop": gl.LINE_LOOP, "line strip": gl.LINE_STRIP, "triangles": gl.TRIANGLES, "triangle strip": gl.TRIANGLE_STRIP, "triangle fan": gl.TRIANGLE_FAN };
    const ClearLayers = { "color": gl.COLOR_BUFFER_BIT, "depth": gl.DEPTH_BUFFER_BIT, "color and depth": gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT };
  
    const texture = getDefaultTexture();
    const meshes = new Map();
    const programs = new ProgramManager();
    const modelDecoder = new ModelDecoder();
    const publicApi = runtime.ext_xeltallivSimple3Dapi ?? (runtime.ext_xeltallivSimple3Dapi = {});
    const externalTransforms = publicApi.externalTransforms ?? (publicApi.externalTransforms = {});
    const canvasRenderTarget = new CanvasRenderTarget();
  
    let drawableId = null;
    let skinId = null;
    let currentRenderTarget;
    let transforms;
    let transformed;
    let selectedTransform;
    let colorMultiplier;
    let colorAdder;
    let fogColor;
    let fogDistance;
    let fogEnabled;
    let fogPosition;
    let fogSpace;
    let imageSource;
    let imageSourceSync;
    let currentBlending;
    let currentBlendingProps;
    let currentCulling;
    let currentCullingProps;
    let lastTextMeasurement;
    let transformCache;
    // === 新增：FPS 鼠标控制变量 ===
    let mouseDeltaX = 0;
    let mouseDeltaY = 0;
    document.addEventListener("mousemove", (e) => {
        if (document.pointerLockElement === canvas) {
            mouseDeltaX += e.movementX;
            mouseDeltaY += e.movementY;
        }
    });
    // === 新增：全局光影状态变量 ===
    let lightEnabled = 0.0; 
    let lightDir = [0.5, 1.0, 0.3]; 
    let lightColor = [1.0, 1.0, 1.0]; 
    let ambientColor = [0.4, 0.4, 0.4];
   // === 新增 1：全局地形颜色与透明度状态管理器 (RGBA) ===
let terrainColors = {
    ocean: [0.0, 0.1, 0.4, 1.0],
    shallows: [0.0, 0.4, 0.8, 1.0],
    plains: [0.1, 0.6, 0.1, 1.0],
    mountains: [0.6, 0.4, 0.2, 1.0],
    snow: [1.0, 1.0, 1.0, 1.0]
};
// === 新增：保存地形雷达数据，供碰撞检测和 LOD 使用 ===
let globalTerrainInfo = null;
// 将 Scratch 的 HEX 颜色和 0~100 的透明度，转换为 WebGL 的 0.0~1.0 标准
function parseColorAndAlpha(hexStr, alphaPercent) {
    let color = Cast.toString(hexStr).replace('#', '');
    if (color.length === 3) color = color.split('').map(c => c + c).join('');
    let intVal = parseInt(color, 16);
    if (isNaN(intVal)) return [1, 1, 1, 1];
    
    let a = Math.max(0, Math.min(100, Cast.toNumber(alphaPercent))) / 100.0;
    return [((intVal >> 16) & 255) / 255.0, ((intVal >> 8) & 255) / 255.0, (intVal & 255) / 255.0, a];
}
    function resetEverything() {



      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


      // 1. 强制重置视口到全屏
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        
      // 2. 关键补丁：关闭剪裁测试 (Scissor Test)
      // 如果“边界”积木开启了 scissor，即使重置了视口，它也会像面罩一样挡住画面
      gl.disable(gl.SCISSOR_TEST);
      
      // 3. 顺便重置 Scissor 区域到全屏（以防万一）
      gl.scissor(0, 0, gl.canvas.width, gl.canvas.height);
      
      // 4. 清除缓存
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    //   //
    //     gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        
    //     // 顺便清除下颜色和深度缓存，确保彻底重置
    //     gl.clearColor(0, 0, 0, 0);
    //     gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    //   //
      canvasRenderTarget.reset();
      canvasRenderTarget.setAsRenderTarget();
      transforms = {
        modelToWorld: m4.identity(),
        worldToView: m4.identity(),
        viewToProjected: m4.identity(),
        import: m4.identity(),
        custom: m4.identity(),
      };
      transformed = [0, 0, 0, 0];
      selectedTransform = "viewToProjected";
      colorMultiplier = [1, 1, 1, 1];
      colorAdder = [0, 0, 0, 0];
      fogColor = [1, 1, 1];
      fogDistance = [10, 90];
      fogEnabled = false;
      fogPosition = null;
      fogSpace = "view space";
      imageSource = null;
      imageSourceSync = null;
      currentBlending = "unset";
      currentBlendingProps = [null, null, null, null, null, null];
      currentCulling = 0;
      currentCullingProps = [null, null];
      lastTextMeasurement = null;
      transformCache = { from: m4.identity(), to: m4.identity(), matrix: m4.identity() };
      // === 新增：重置光影 ===
      lightEnabled = 0.0;
      lightDir = [0.5, 1.0, 0.3];
      lightColor = [1.0, 1.0, 1.0];
      ambientColor = [0.4, 0.4, 0.4];
      for (const mesh of meshes.values()) { mesh.destroy(); }
      meshes.clear();
      programs.clear();
      modelDecoder.clear();
      canvasDirty = true;
      renderer.dirty = true;
      runtime.requestRedraw();
    }
    resetEverything();
    addSimple3DLayer(publicApi);
    runtime.on("PROJECT_LOADED", resetEverything);
  
    // === 所有积木的汉化定义 ===
    const definitions = [
      {
        blockType: BlockType.BUTTON,
        text: "打开额外资源 (官方)",
        func: "openSite",
        def: function () { window.open("https://xeltalliv.github.io/simple3d-extension/"); },
      },
      {
        blockType: BlockType.BUTTON,
        text: "打开官方示例项目",
        func: "getSampleProject",
        def: function () {
          const url = new URL(location.href);
          url.searchParams.set("project_url", "https://extensions.turbowarp.org/samples/Simple3D%20template.sb3");
          window.open(url.href);
        },
      },

// ==========================================
      // 🎮 3D 通用角色与摄像机引擎 (Generic 3D Engine)
      // ==========================================
      {
        blockType: BlockType.LABEL,
        text: "🎮 通用角色与摄像机 (Player & Camera)",
      },
      {
        opcode: "engineInitPlayer",
        blockType: BlockType.COMMAND,
        text: "🎮 引擎：初始化角色位置 X:[X] Y:[Y] Z:[Z]",
        arguments: {
          X: { type: ArgumentType.NUMBER, defaultValue: 0 },
          Y: { type: ArgumentType.NUMBER, defaultValue: 6000 },
          Z: { type: ArgumentType.NUMBER, defaultValue: 0 }
        },
        def: function ({ X, Y, Z }) {
          // 初始化一个 4x4 矩阵来记录角色的绝对坐标与姿态
          window.playerMat = [1,0,0,0, 0,1,0,0, 0,0,1,0, Cast.toNumber(X), Cast.toNumber(Y), Cast.toNumber(Z), 1];
        }
      },
      {
        opcode: "engineMovePlayer",
        blockType: BlockType.COMMAND,
        text: "🎮 引擎：角色本地移动 向右:[R] 向上:[U] 向前:[F]",
        arguments: {
          R: { type: ArgumentType.NUMBER, defaultValue: 0 },
          U: { type: ArgumentType.NUMBER, defaultValue: 0 },
          F: { type: ArgumentType.NUMBER, defaultValue: 10 }
        },
        def: function ({ R, U, F }) {
          if (!window.playerMat) window.playerMat = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
          // 在 3D 图形学中，-Z 代表正前方。底层直接根据当前朝向进行本地平移
          window.playerMat = m4.translate(window.playerMat, Cast.toNumber(R), Cast.toNumber(U), -Cast.toNumber(F));
        }
      },
      {
        opcode: "engineRotatePlayer",
        blockType: BlockType.COMMAND,
        text: "🎮 引擎：角色本地旋转 俯仰(X轴):[P] 偏航(Y轴):[Y] 滚转(Z轴):[R]",
        arguments: {
          P: { type: ArgumentType.NUMBER, defaultValue: 0 },
          Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
          R: { type: ArgumentType.NUMBER, defaultValue: 0 }
        },
        def: function ({ P, Y, R }) {
          if (!window.playerMat) window.playerMat = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
          let p = Cast.toNumber(P) * Math.PI / 180;
          let y = Cast.toNumber(Y) * Math.PI / 180;
          let r = Cast.toNumber(R) * Math.PI / 180;
          
          let m = window.playerMat;
          // 应用旋转：按标准 Y -> X -> Z 顺序
          m = m4.yRotate(m, -y);
          m = m4.xRotate(m, p);
          m = m4.zRotate(m, -r);
          
          // 🌟 终极防爆锁：正交化矩阵（Orthonormalization）
          // 无论旋转多少次，强制重新校准 XYZ 三根轴的垂直关系，永远防止模型变形或坐标系崩溃
          let xVec = m4.normalize([m[0], m[1], m[2]]);
          let yVec = [m[4], m[5], m[6]];
          let zVec = m4.normalize(m4.cross(xVec, yVec));
          yVec = m4.normalize(m4.cross(zVec, xVec));
          
          m[0]=xVec[0]; m[1]=xVec[1]; m[2]=xVec[2];
          m[4]=yVec[0]; m[5]=yVec[1]; m[6]=yVec[2];
          m[8]=zVec[0]; m[9]=zVec[1]; m[10]=zVec[2];
          
          window.playerMat = m;
        }
      },
      {
        opcode: "engineAttachCamera",
        blockType: BlockType.COMMAND,
        text: "🎥 引擎：摄像机机位设定 (镜头相对位置 右:[CX] 上:[CY] 前:[CZ] | 看向相对位置 右:[TX] 上:[TY] 前:[TZ])",
        arguments: {
          CX: { type: ArgumentType.NUMBER, defaultValue: 0 }, CY: { type: ArgumentType.NUMBER, defaultValue: 100 }, CZ: { type: ArgumentType.NUMBER, defaultValue: -300 },
          TX: { type: ArgumentType.NUMBER, defaultValue: 0 }, TY: { type: ArgumentType.NUMBER, defaultValue: 0 }, TZ: { type: ArgumentType.NUMBER, defaultValue: 100 }
        },
        def: function ({ CX, CY, CZ, TX, TY, TZ }) {
          if (!window.playerMat) return;
          let m = window.playerMat;
          
          // 根据角色的矩阵，计算出空间中的绝对坐标
          let getPos = (right, up, fwd) => [
              m[12] + m[0]*right + m[4]*up + m[8]*(-fwd),
              m[13] + m[1]*right + m[5]*up + m[9]*(-fwd),
              m[14] + m[2]*right + m[6]*up + m[10]*(-fwd)
          ];
          
          let camPos = getPos(Cast.toNumber(CX), Cast.toNumber(CY), Cast.toNumber(CZ));
          let targetPos = getPos(Cast.toNumber(TX), Cast.toNumber(TY), Cast.toNumber(TZ));
          let upVec = [m[4], m[5], m[6]]; 
          
          // 应用逆矩阵给摄像机
          transforms[selectedTransform] = m4.inverse(m4.lookAt(camPos, targetPos, upVec));
        }
      },
      {
        opcode: "engineRenderPlayer",
        blockType: BlockType.COMMAND,
        text: "🎮 引擎：渲染角色模型 (修正初始俯仰:[FX] 修正初始偏航:[FY] 修正初始滚转:[FZ])",
        arguments: {
          FX: { type: ArgumentType.NUMBER, defaultValue: -90 },
          FY: { type: ArgumentType.NUMBER, defaultValue: 180 },
          FZ: { type: ArgumentType.NUMBER, defaultValue: 0 }
        },
        def: function ({ FX, FY, FZ }) {
          if (!window.playerMat) return;
          let m = window.playerMat.slice();
          m = m4.xRotate(m, Cast.toNumber(FX) * Math.PI / 180);
          m = m4.yRotate(m, Cast.toNumber(FY) * Math.PI / 180);
          m = m4.zRotate(m, Cast.toNumber(FZ) * Math.PI / 180);
          transforms[selectedTransform] = m;
        }
      },
      {
        opcode: "engineGetPlayerPos",
        blockType: BlockType.REPORTER,
        text: "🎮 引擎：获取角色全局 [AXIS] 坐标",
        arguments: { AXIS: { type: ArgumentType.STRING, menu: "axis" } },
        def: function ({ AXIS }) {
          if(!window.playerMat) return 0;
          if(AXIS === "X") return window.playerMat[12];
          if(AXIS === "Y") return window.playerMat[13];
          if(AXIS === "Z") return window.playerMat[14];
          return 0;
        }
      },
      // ==========================================
// === 终极实心版：全球立体星球 (带完美球面宏观光照烘焙 + 透明镂空优化) ===
{
    opcode: "particlesFromCostumeHeightmap",
    blockType: BlockType.COMMAND,
    text: "🗺️【清爽版】将造型 [COSTUME] 转为 [SHAPE] 地形 模型 [NAME] 尺寸 [RADIUS] 数量 [COUNT] 起伏 [STR]",
    arguments: {
      COSTUME: { type: ArgumentType.COSTUME }, 
      SHAPE: { type: ArgumentType.STRING, menu: "mappingShape", defaultValue: "plane" },
      NAME: { type: ArgumentType.STRING, defaultValue: "基准微粒" },
      RADIUS: { type: ArgumentType.NUMBER, defaultValue: 200 },
      COUNT: { type: ArgumentType.NUMBER, defaultValue: 40000 },
      STR: { type: ArgumentType.NUMBER, defaultValue: 50 }
    },
    def: function (args, { target }) {
      return new Promise((resolve) => {
        let NAME = Cast.toString(args.NAME).replace(/,/g, "").trim();
        const mesh = meshes.get(NAME);
        if (!mesh) { resolve(); return; }
  
        const costumeIndex = target.getCostumeIndexByName(args.COSTUME);
        if (costumeIndex == -1) { resolve(); return; }
        const costume = target.sprite.costumes[costumeIndex];
  
        let shapeType = Cast.toString(args.SHAPE);
        let numParticles = Math.floor(Cast.toNumber(args.COUNT));
        let size = Cast.toNumber(args.RADIUS);
        let strength = Cast.toNumber(args.STR);
  
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  
          function getBrightnessBilinear(x, y) {
              x = Math.max(0, Math.min(canvas.width - 1.001, x));
              y = Math.max(0, Math.min(canvas.height - 1.001, y));
              let x1 = Math.floor(x), y1 = Math.floor(y);
              let x2 = x1 + 1, y2 = y1 + 1;
              let tx = x - x1, ty = y - y1;
              let b11 = imgData[(y1 * canvas.width + x1) * 4] / 255.0;
              let b21 = imgData[(y1 * canvas.width + x2) * 4] / 255.0;
              let b12 = imgData[(y2 * canvas.width + x1) * 4] / 255.0;
              let b22 = imgData[(y2 * canvas.width + x2) * 4] / 255.0;
              return (b11 * (1 - tx) + b21 * tx) * (1 - ty) + (b12 * (1 - tx) + b22 * tx) * ty;
          }
  
          // 💡 修复一：删除了内部写死的颜色，直接读取外部（UI积木）设定的全局 terrainColors！
          function getGradientColor(brightness) {
              let r = 1, g = 1, b = 1, a = 1;
              const palette = [
                  { h: 0.00, c: terrainColors.ocean }, { h: 0.10, c: terrainColors.shallows },
                  { h: 0.25, c: terrainColors.plains }, { h: 0.60, c: terrainColors.mountains },
                  { h: 0.85, c: terrainColors.snow }
              ];
              for (let j = 0; j < palette.length - 1; j++) {
                  let c1 = palette[j], c2 = palette[j + 1];
                  if (brightness >= c1.h && brightness <= c2.h) {
                      let t = (brightness - c1.h) / (c2.h - c1.h);
                      r = c1.c[0] * (1 - t) + c2.c[0] * t; g = c1.c[1] * (1 - t) + c2.c[1] * t; b = c1.c[2] * (1 - t) + c2.c[2] * t; a = c1.c[3] * (1 - t) + c2.c[3] * t;
                      break;
                  }
              }
              if (brightness >= 0.85) { r = terrainColors.snow[0]; g = terrainColors.snow[1]; b = terrainColors.snow[2]; a = terrainColors.snow[3]; }
              return { r, g, b, a };
          }
  
          function getSpherePos(u, v) {
              let lon = (1.0 - u) * 2 * Math.PI;
              let ny = Math.cos(v * Math.PI);
              let rAtY = Math.sqrt(1 - ny * ny);
              let nx = Math.cos(lon) * rAtY;
              let nz = Math.sin(lon) * rAtY;
              let br = getBrightnessBilinear(u * (canvas.width - 1), v * (canvas.height - 1));
              let radius = size + br * strength;
              return [nx * radius, ny * radius, nz * radius];
          }
  
          let transforms = [];
          let colors = [];
          let gridSize = (shapeType === "sphere") ? (size * Math.sqrt(12.56 / numParticles)) : (size / Math.sqrt(numParticles));
          let dropStep = gridSize; 
          let baseLayers = 5; 
  
          if (shapeType === "sphere") {
              const phi_golden = Math.PI * (3 - Math.sqrt(5));
              for (let i = 0; i < numParticles; i++) {
                  let y = 1 - (i / (numParticles - 1)) * 2;
                  let rAtY = Math.sqrt(1 - y * y);
                  let theta = phi_golden * i;
                  let nx = Math.cos(theta) * rAtY, ny = y, nz = Math.sin(theta) * rAtY;
                  
                  let lonAngle = Math.atan2(nz, nx);
                  if (lonAngle < 0) lonAngle += 2 * Math.PI; 
                  let u = 1.0 - (lonAngle / (2 * Math.PI)); 
                  let v = Math.acos(ny) / Math.PI;
                  
                  let sampleX = u * (canvas.width - 1);
                  let sampleY = v * (canvas.height - 1);
                  let brightness = getBrightnessBilinear(sampleX, sampleY);
                  let surfaceRadius = size + (brightness * strength);
                  
                  let { r, g, b, a } = getGradientColor(brightness);
  
                  // === 💡 修复二：透明镂空剔除机制 ===
                  // 如果当前地形的透明度小于 0.05（海洋部分），直接跳过！不生成方块！
                  if (a < 0.05) continue;
  
                  // 宏观法线烘焙
                  let offU = 2.0 / canvas.width;
                  let offV = 2.0 / canvas.height;
                  let pL = getSpherePos(u - offU, v);
                  let pR = getSpherePos(u + offU, v);
                  let pU = getSpherePos(u, Math.max(0.001, v - offV)); 
                  let pD = getSpherePos(u, Math.min(0.999, v + offV));
                  let dx1 = pR[0] - pL[0], dy1 = pR[1] - pL[1], dz1 = pR[2] - pL[2];
                  let dx2 = pD[0] - pU[0], dy2 = pD[1] - pU[1], dz2 = pD[2] - pU[2];
                  let normX = dy1 * dz2 - dz1 * dy2;
                  let normY = dz1 * dx2 - dx1 * dz2;
                  let normZ = dx1 * dy2 - dy1 * dx2;
                  
                  if (normX * nx + normY * ny + normZ * nz < 0) {
                      normX = -normX; normY = -normY; normZ = -normZ;
                  }
                  
                  let len = Math.sqrt(normX*normX + normY*normY + normZ*normZ) || 1;
                  normX /= len; normY /= len; normZ /= len;
  
                  let ld = typeof lightDir !== 'undefined' ? lightDir : [0.5, 1.0, 0.3];
                  let lc = typeof lightColor !== 'undefined' ? lightColor : [1.0, 1.0, 1.0];
                  let ac = typeof ambientColor !== 'undefined' ? ambientColor : [0.4, 0.4, 0.4];
  
                  let diff = Math.max(0, normX * ld[0] + normY * ld[1] + normZ * ld[2]);
                  r *= ac[0] + lc[0] * diff;
                  g *= ac[1] + lc[1] * diff;
                  b *= ac[2] + lc[2] * diff;
  
                  let totalLayers = baseLayers + Math.ceil((brightness * strength) / dropStep);
                  for(let L = 0; L < totalLayers; L++) {
                      let rDrop = surfaceRadius - (L * dropStep);
                      if(rDrop < size - (baseLayers * dropStep)) break;
                      transforms.push(rDrop*nx, rDrop*ny, rDrop*nz);
                      colors.push(r, g, b, a); 
                  }
              }
          } else {
              let gridDim = Math.floor(Math.sqrt(numParticles));
              for (let i = 0; i < gridDim * gridDim; i++) {
                  let u = (i % gridDim) / (gridDim - 1);
                  let v = Math.floor(i / gridDim) / (gridDim - 1);
                  let sampleX = u * (canvas.width - 1);
                  let sampleY = v * (canvas.height - 1);
                  
                  let brightness = getBrightnessBilinear(sampleX, sampleY);
                  let surfaceH = brightness * strength;
                  let px = (u - 0.5) * size;
                  let pz = (v - 0.5) * size;
                  
                  let { r, g, b, a } = getGradientColor(brightness);
                  
                  // === 💡 修复二：平面模式同样执行透明剔除 ===
                  if (a < 0.05) continue;
  
                  let offset = 2.0;
                  let dx = (getBrightnessBilinear(sampleX + offset, sampleY) - getBrightnessBilinear(sampleX - offset, sampleY)) * strength;
                  let dz = (getBrightnessBilinear(sampleX, sampleY + offset) - getBrightnessBilinear(sampleX, sampleY - offset)) * strength;
                  let dist = (offset / canvas.width) * size;
                  
                  let nx = -dx, ny = dist * 2.0, nz = -dz;
                  let len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
                  nx /= len; ny /= len; nz /= len;
  
                  let ld = typeof lightDir !== 'undefined' ? lightDir : [0.5, 1.0, 0.3];
                  let lc = typeof lightColor !== 'undefined' ? lightColor : [1.0, 1.0, 1.0];
                  let ac = typeof ambientColor !== 'undefined' ? ambientColor : [0.4, 0.4, 0.4];
  
                  let diff = Math.max(0, nx * ld[0] + ny * ld[1] + nz * ld[2]);
                  r *= ac[0] + lc[0] * diff; g *= ac[1] + lc[1] * diff; b *= ac[2] + lc[2] * diff;
  
                  let totalLayers = baseLayers + Math.ceil(surfaceH / dropStep);
                  for(let L = 0; L < totalLayers; L++) {
                      let yDrop = surfaceH - (L * dropStep);
                      transforms.push(px, Math.max(0, yDrop), pz);
                      colors.push(r, g, b, a);
                      if(yDrop <= 0) break;
                  }
              }
          }
          
          uploadBuffer(mesh, "instanceTransforms", new Float32Array(transforms), 3, 1);
          uploadBuffer(mesh, "instanceColors", new Float32Array(colors), 4, 1);
          resolve();
        };
        img.onerror = () => { resolve(); };
        img.src = costume.asset.encodeDataURI(); 
      });
    }
  },
 // === 新增 2：UI 动态颜色与透明度配置积木 ===
 {
    opcode: "setTerrainColors",
    blockType: BlockType.COMMAND,
    text: "🎨设置地形色彩：深海[COLOR_A] 透明度[ALPHA_A] 浅海[COLOR_B] 透明度[ALPHA_B] 平原[COLOR_C] 透明度[ALPHA_C] 高山[COLOR_D] 透明度[ALPHA_D] 雪峰[COLOR_E] 透明度[ALPHA_E]",
    arguments: {
      COLOR_A: { type: ArgumentType.COLOR, defaultValue: "#001a66" }, ALPHA_A: { type: ArgumentType.NUMBER, defaultValue: 100 },
      COLOR_B: { type: ArgumentType.COLOR, defaultValue: "#0066cc" }, ALPHA_B: { type: ArgumentType.NUMBER, defaultValue: 100 },
      COLOR_C: { type: ArgumentType.COLOR, defaultValue: "#1a991a" }, ALPHA_C: { type: ArgumentType.NUMBER, defaultValue: 100 },
      COLOR_D: { type: ArgumentType.COLOR, defaultValue: "#996633" }, ALPHA_D: { type: ArgumentType.NUMBER, defaultValue: 100 },
      COLOR_E: { type: ArgumentType.COLOR, defaultValue: "#ffffff" }, ALPHA_E: { type: ArgumentType.NUMBER, defaultValue: 100 }
    },
    def: function (args) {
      // 将 UI 传进来的颜色和透明度，实时写入全局状态
      terrainColors.ocean = parseColorAndAlpha(args.COLOR_A, args.ALPHA_A);
      terrainColors.shallows = parseColorAndAlpha(args.COLOR_B, args.ALPHA_B);
      terrainColors.plains = parseColorAndAlpha(args.COLOR_C, args.ALPHA_C);
      terrainColors.mountains = parseColorAndAlpha(args.COLOR_D, args.ALPHA_D);
      terrainColors.snow = parseColorAndAlpha(args.COLOR_E, args.ALPHA_E);
    }
  },
   // === 新增 3：地形海拔雷达探测积木 (用于体积碰撞与高度检测) ===
   {
    opcode: "getTerrainAltitude",
    blockType: BlockType.REPORTER,
    text: "🏔️雷达：获取空间坐标 X:[X] Y:[Y] Z:[Z] 的地表海拔",
    arguments: {
      X: { type: ArgumentType.NUMBER, defaultValue: 0 },
      Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
      Z: { type: ArgumentType.NUMBER, defaultValue: 0 }
    },
    def: function (args) {
       if (!globalTerrainInfo) return 0;
       let x = Cast.toNumber(args.X), y = Cast.toNumber(args.Y), z = Cast.toNumber(args.Z);
       let { imgData, width, height, shapeType, size, strength, cu, cv, zoom } = globalTerrainInfo;

       // 星球模式的雷达测算
       if (shapeType === "sphere") {
           let len = Math.sqrt(x*x + y*y + z*z);
           if (len === 0) return size;
           let nx = x/len, ny = y/len, nz = z/len;
           
           let lonAngle = Math.atan2(nz, nx);
           if (lonAngle < 0) lonAngle += 2 * Math.PI;
           let u = 1.0 - (lonAngle / (2 * Math.PI)); 
           let v = Math.acos(ny) / Math.PI;

           let pixelX = Math.floor(u * (width - 1));
           let pixelY = Math.floor(v * (height - 1));
           let brightness = imgData[(pixelY * width + pixelX) * 4] / 255.0;
           return brightness > 0.05 ? size + brightness * strength : size;
       } 
       // 局部沙盘/平面模式的雷达测算
       else {
           let aspect = (width * zoom) / (height * zoom);
           // 将真实坐标映射回局部的 0~1
           let localU = (x / size) + 0.5;
           let localV = (z / (size / aspect)) + 0.5;
           if (localU < 0 || localU > 1 || localV < 0 || localV > 1) return 0; 
           
           // 将局部 0~1 映射回大图的真实 UV
           let sampleU = (localU - 0.5) * zoom + cu;
           let sampleV = (localV - 0.5) * zoom + cv;
           sampleU = Math.max(0, Math.min(1, sampleU));
           sampleV = Math.max(0, Math.min(1, sampleV));

           let pixelX = Math.floor(sampleU * (width - 1));
           let pixelY = Math.floor(sampleV * (height - 1));
           let brightness = imgData[(pixelY * width + pixelX) * 4] / 255.0;
           return brightness * strength;
       }
    }
  },
// === 终极版：局部精细化 LOD (带宏观地形光影烘焙技术) ===
{
  opcode: "particlesFromHeightmapRegion",
  blockType: BlockType.COMMAND,
  text: "🗺️局部精细化：提取造型[COSTUME] 中心 U:[CU] V:[CV] 视野缩放:[ZOOM] 模型:[NAME] 物理宽:[RADIUS] 数量:[COUNT] 起伏:[STR]",
  arguments: {
    COSTUME: { type: ArgumentType.COSTUME }, 
    CU: { type: ArgumentType.NUMBER, defaultValue: 0.77 }, 
    CV: { type: ArgumentType.NUMBER, defaultValue: 0.35 }, 
    ZOOM: { type: ArgumentType.NUMBER, defaultValue: 0.05 },
    NAME: { type: ArgumentType.STRING, defaultValue: "基准微粒" },
    RADIUS: { type: ArgumentType.NUMBER, defaultValue: 800 }, 
    COUNT: { type: ArgumentType.NUMBER, defaultValue: 80000 },
    STR: { type: ArgumentType.NUMBER, defaultValue: 150 }
  },
  def: function (args, { target }) {
    return new Promise((resolve) => {
      let NAME = Cast.toString(args.NAME).replace(/,/g, "").trim();
      const mesh = meshes.get(NAME);
      if (!mesh) { resolve(); return; }

      const costumeIndex = target.getCostumeIndexByName(args.COSTUME);
      if (costumeIndex == -1) { resolve(); return; }
      const costume = target.sprite.costumes[costumeIndex];

      let cu = Cast.toNumber(args.CU); let cv = Cast.toNumber(args.CV);
      let zoom = Cast.toNumber(args.ZOOM); let numParticles = Math.floor(Cast.toNumber(args.COUNT));
      let size = Cast.toNumber(args.RADIUS); let strength = Cast.toNumber(args.STR);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        function hash(x, y) { let n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n); }
        function noise(x, y) {
            let ix = Math.floor(x), iy = Math.floor(y);
            let fx = x - ix, fy = y - iy;
            let u = fx * fx * (3.0 - 2.0 * fx), v = fy * fy * (3.0 - 2.0 * fy);
            return (1 - u) * (1 - v) * hash(ix, iy) + u * (1 - v) * hash(ix + 1, iy) + (1 - u) * v * hash(ix, iy + 1) + u * v * hash(ix + 1, iy + 1);
        }
        function fbm(x, y, octaves) { let v = 0.0, a = 0.5; for (let i = 0; i < octaves; i++) { v += a * noise(x, y); x *= 2.0; y *= 2.0; a *= 0.5; } return v; }
        function getBrightnessBilinear(x, y) {
            x = Math.max(0, Math.min(canvas.width - 1.001, x)); y = Math.max(0, Math.min(canvas.height - 1.001, y));
            let x1 = Math.floor(x), y1 = Math.floor(y), x2 = x1 + 1, y2 = y1 + 1, tx = x - x1, ty = y - y1;
            let b11 = imgData[(y1 * canvas.width + x1) * 4] / 255.0, b21 = imgData[(y1 * canvas.width + x2) * 4] / 255.0;
            let b12 = imgData[(y2 * canvas.width + x1) * 4] / 255.0, b22 = imgData[(y2 * canvas.width + x2) * 4] / 255.0;
            return (b11 * (1 - tx) + b21 * tx) * (1 - ty) + (b12 * (1 - tx) + b22 * tx) * ty;
        }
        function getGradientColor(brightness) {
            let r = 1, g = 1, b = 1, a = 1;
            const palette = [ { h: 0.00, c: terrainColors.ocean }, { h: 0.10, c: terrainColors.shallows }, { h: 0.25, c: terrainColors.plains }, { h: 0.60, c: terrainColors.mountains }, { h: 0.85, c: terrainColors.snow } ];
            for (let j = 0; j < palette.length - 1; j++) {
                let c1 = palette[j], c2 = palette[j + 1];
                if (brightness >= c1.h && brightness <= c2.h) {
                    let t = (brightness - c1.h) / (c2.h - c1.h);
                    r = c1.c[0] * (1 - t) + c2.c[0] * t; g = c1.c[1] * (1 - t) + c2.c[1] * t; b = c1.c[2] * (1 - t) + c2.c[2] * t; a = c1.c[3] * (1 - t) + c2.c[3] * t; break;
                }
            }
            if (brightness >= 0.85) { r = terrainColors.snow[0]; g = terrainColors.snow[1]; b = terrainColors.snow[2]; a = terrainColors.snow[3]; }
            return { r, g, b, a };
        }

        let transforms = []; let colors = [];
        let aspect = (canvas.width * zoom) / (canvas.height * zoom);
        let gridZ = Math.floor(Math.sqrt(numParticles / aspect)), gridX = Math.floor(numParticles / gridZ);
        let actualCount = gridX * gridZ, dropStep = (size / gridX) * 0.5; 

        for (let i = 0; i < actualCount; i++) {
            let ix = i % gridX, iz = Math.floor(i / gridX);
            let localU = ix / (gridX - 1), localV = iz / (gridZ - 1);
            let sampleU = (localU - 0.5) * zoom + cu, sampleV = (localV - 0.5) * zoom + cv;
            let sampleX = sampleU * (canvas.width - 1), sampleY = sampleV * (canvas.height - 1);

            let finalBrightness = getBrightnessBilinear(sampleX, sampleY);
            if (zoom < 0.2 && finalBrightness > 0.08) {
                let detail = fbm(sampleU * (500.0 / zoom), sampleV * (500.0 / zoom), 3);
                finalBrightness += (detail - 0.5) * ((0.2 - zoom) * 0.15);
            }

            let px = (localU - 0.5) * size, pz = (localV - 0.5) * (size / aspect), py = finalBrightness * strength; 
            let { r, g, b, a } = getGradientColor(finalBrightness);

            // 🌟 宏观法线光照烘焙
            let offset = 2.0; 
            let dx = (getBrightnessBilinear(sampleX + offset, sampleY) - getBrightnessBilinear(sampleX - offset, sampleY)) * strength;
            let dz = (getBrightnessBilinear(sampleX, sampleY + offset) - getBrightnessBilinear(sampleX, sampleY - offset)) * strength;
            let dist = (offset / canvas.width) * (size / zoom);

            let nx = -dx, ny = dist * 2.0, nz = -dz;
            let len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
            nx /= len; ny /= len; nz /= len;

            let ld = typeof lightDir !== 'undefined' ? lightDir : [0.5, 1.0, 0.3];
            let lc = typeof lightColor !== 'undefined' ? lightColor : [1.0, 1.0, 1.0];
            let ac = typeof ambientColor !== 'undefined' ? ambientColor : [0.4, 0.4, 0.4];

            let diff = Math.max(0, nx * ld[0] + ny * ld[1] + nz * ld[2]);
            r *= ac[0] + lc[0] * diff; g *= ac[1] + lc[1] * diff; b *= ac[2] + lc[2] * diff;

            let minNeighbor = getBrightnessBilinear(sampleX - 1, sampleY - 1);
            let visibleDrop = py - (minNeighbor * strength);
            let fillLayers = visibleDrop > 0 ? Math.max(1, Math.ceil(visibleDrop / dropStep) + 15) : 1;

            for (let L = 0; L < fillLayers; L++) {
                let yDrop = Math.max(0, py - (L * dropStep));
                transforms.push(px, yDrop, pz);
                colors.push(r, g, b, a); // 纯色烘焙，无递减伪阴影
                if (yDrop === 0) break; 
            }
        }

        globalTerrainInfo = { imgData: imgData, width: canvas.width, height: canvas.height, shapeType: "plane_region", size: size, strength: strength, cu: cu, cv: cv, zoom: zoom };
        uploadBuffer(mesh, "instanceTransforms", new Float32Array(transforms), 3, 1);
        uploadBuffer(mesh, "instanceColors", new Float32Array(colors), 4, 1);
        resolve();
      };
      img.onerror = () => { resolve(); };
      img.src = costume.asset.encodeDataURI(); 
    });
  }
},
// ==========================================
// 🖱️ FPS 鼠标控制系统
// ==========================================
{ blockType: BlockType.LABEL, text: "🖱️ FPS 鼠标系统" },
{ opcode: "lockMouse", blockType: BlockType.COMMAND, text: "🖱️ FPS：锁定并隐藏鼠标 (点击画面后生效)", def: function() { if (canvas) canvas.requestPointerLock(); } },
{ opcode: "unlockMouse", blockType: BlockType.COMMAND, text: "🖱️ FPS：解锁鼠标", def: function() { document.exitPointerLock(); } },
{
  opcode: "getMouseDelta", blockType: BlockType.REPORTER, text: "🖱️ FPS：获取鼠标偏移量 [AXIS]",
  arguments: { AXIS: { type: ArgumentType.STRING, menu: "axisXY", defaultValue: "X" } },
  def: function({ AXIS }) { let val = AXIS === "X" ? mouseDeltaX : mouseDeltaY; if (AXIS === "X") mouseDeltaX = 0; if (AXIS === "Y") mouseDeltaY = 0; return val; }
},
// ==========================================
// ⛏️ 我的世界：动态体素引擎 (Voxel Core)
// ==========================================
{ blockType: BlockType.LABEL, text: "⛏️ 我的世界体素引擎" },
{
  opcode: "voxelGenerateWorld", blockType: BlockType.COMMAND, text: "⛏️ 引擎：将造型 [COSTUME] 转为方块世界 (尺寸:[SIZE] 宽:[W] 长:[H] 起伏:[STR])",
  arguments: { COSTUME: { type: ArgumentType.COSTUME }, SIZE: { type: ArgumentType.NUMBER, defaultValue: 10 }, W: { type: ArgumentType.NUMBER, defaultValue: 1000 }, H: { type: ArgumentType.NUMBER, defaultValue: 1000 }, STR: { type: ArgumentType.NUMBER, defaultValue: 200 } },
  def: function(args, { target }) {
    return new Promise((resolve) => {
        const costumeIndex = target.getCostumeIndexByName(args.COSTUME); if (costumeIndex == -1) { resolve(); return; }
        const costume = target.sprite.costumes[costumeIndex];
        if(!window.voxelWorld) window.voxelWorld = new Map(); window.voxelWorld.clear(); window.voxelSize = Cast.toNumber(args.SIZE);
        let w = Cast.toNumber(args.W), h = Cast.toNumber(args.H), str = Cast.toNumber(args.STR);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let gridXCount = Math.floor(w / window.voxelSize), gridZCount = Math.floor(h / window.voxelSize);
            let startX = -Math.floor(gridXCount/2) * window.voxelSize, startZ = -Math.floor(gridZCount/2) * window.voxelSize;

            for(let ix = 0; ix < gridXCount; ix++) {
                for(let iz = 0; iz < gridZCount; iz++) {
                    let px = startX + ix * window.voxelSize, pz = startZ + iz * window.voxelSize;
                    let imgX = Math.floor((ix / (gridXCount - 1)) * (canvas.width - 1)), imgY = Math.floor((iz / (gridZCount - 1)) * (canvas.height - 1));
                    let b = imgData[(imgY * canvas.width + imgX) * 4] / 255.0;
                    let surfaceY = Math.round((b * str) / window.voxelSize) * window.voxelSize;
                    for(let layer = 0; layer < 3; layer++) {
                        let py = surfaceY - layer * window.voxelSize;
                        let r = 0.4, g = 0.4, b_col = 0.4; 
                        if (layer === 0) { r = 0.3; g = 0.7; b_col = 0.2; } else if (layer === 1) { r = 0.5; g = 0.3; b_col = 0.1; } 
                        window.voxelWorld.set(`${px}_${py}_${pz}`, {r: r, g: g, b: b_col, a: 1.0});
                    }
                }
            }
            resolve();
        };
        img.onerror = () => resolve(); img.src = costume.asset.encodeDataURI();
    });
  }
},
{
  opcode: "voxelRaycast", blockType: BlockType.REPORTER, text: "⛏️ 探测：从摄像机 X:[X] Y:[Y] Z:[Z] 偏航:[YAW] 俯仰:[PITCH] 寻找方块返回 [PROP]",
  arguments: { X: { type: ArgumentType.NUMBER }, Y: { type: ArgumentType.NUMBER }, Z: { type: ArgumentType.NUMBER }, YAW: { type: ArgumentType.NUMBER }, PITCH: { type: ArgumentType.NUMBER }, PROP: { type: ArgumentType.STRING, menu: "voxelRayProp", defaultValue: "命中方块X" } },
  def: function(args) {
      if(!window.voxelWorld || !window.voxelSize) return "";
      let cx = Cast.toNumber(args.X), cy = Cast.toNumber(args.Y), cz = Cast.toNumber(args.Z);
      let yaw = Cast.toNumber(args.YAW) * Math.PI / 180, pitch = Cast.toNumber(args.PITCH) * Math.PI / 180;
      let dirX = Math.sin(yaw) * Math.cos(pitch), dirY = Math.sin(pitch), dirZ = -Math.cos(yaw) * Math.cos(pitch);
      let rayX = cx, rayY = cy, rayZ = cz, stepDist = window.voxelSize * 0.2, lastEmptyX = null, lastEmptyY = null, lastEmptyZ = null;
      for(let i=0; i<300; i++) {
          let gridX = Math.round(rayX / window.voxelSize) * window.voxelSize;
          let gridY = Math.round(rayY / window.voxelSize) * window.voxelSize;
          let gridZ = Math.round(rayZ / window.voxelSize) * window.voxelSize;
          if (window.voxelWorld.has(`${gridX}_${gridY}_${gridZ}`)) {
              let p = args.PROP;
              if (p === "命中方块X") return gridX; if (p === "命中方块Y") return gridY; if (p === "命中方块Z") return gridZ;
              if (p === "相邻空位X") return lastEmptyX !== null ? lastEmptyX : gridX;
              if (p === "相邻空位Y") return lastEmptyY !== null ? lastEmptyY : gridY;
              if (p === "相邻空位Z") return lastEmptyZ !== null ? lastEmptyZ : gridZ;
              return "";
          } else { lastEmptyX = gridX; lastEmptyY = gridY; lastEmptyZ = gridZ; }
          rayX += dirX * stepDist; rayY += dirY * stepDist; rayZ += dirZ * stepDist;
      }
      return "";
  }
},
{
  opcode: "voxelSetBlock", blockType: BlockType.COMMAND, text: "⛏️ 操作：放置方块在 X:[X] Y:[Y] Z:[Z] 颜色 R:[R] G:[G] B:[B]",
  arguments: { X: { type: ArgumentType.NUMBER }, Y: { type: ArgumentType.NUMBER }, Z: { type: ArgumentType.NUMBER }, R: { type: ArgumentType.NUMBER, defaultValue: 0.8 }, G: { type: ArgumentType.NUMBER, defaultValue: 0.2 }, B: { type: ArgumentType.NUMBER, defaultValue: 0.2 } },
  def: function({X, Y, Z, R, G, B}) {
      if(!window.voxelWorld || !window.voxelSize) return;
      let gx = Math.round(Cast.toNumber(X) / window.voxelSize) * window.voxelSize, gy = Math.round(Cast.toNumber(Y) / window.voxelSize) * window.voxelSize, gz = Math.round(Cast.toNumber(Z) / window.voxelSize) * window.voxelSize;
      window.voxelWorld.set(`${gx}_${gy}_${gz}`, { r: Cast.toNumber(R), g: Cast.toNumber(G), b: Cast.toNumber(B), a: 1.0 });
  }
},
{
  opcode: "voxelRemoveBlock", blockType: BlockType.COMMAND, text: "⛏️ 操作：摧毁位于 X:[X] Y:[Y] Z:[Z] 的方块",
  arguments: { X: { type: ArgumentType.NUMBER }, Y: { type: ArgumentType.NUMBER }, Z: { type: ArgumentType.NUMBER } },
  def: function({X, Y, Z}) {
      if(!window.voxelWorld || !window.voxelSize) return;
      let gx = Math.round(Cast.toNumber(X) / window.voxelSize) * window.voxelSize, gy = Math.round(Cast.toNumber(Y) / window.voxelSize) * window.voxelSize, gz = Math.round(Cast.toNumber(Z) / window.voxelSize) * window.voxelSize;
      window.voxelWorld.delete(`${gx}_${gy}_${gz}`);
  }
},
{
  opcode: "voxelUpdateMesh", blockType: BlockType.COMMAND, text: "⛏️ 引擎：将方块世界同步渲染到模型 [NAME]",
  arguments: { NAME: { type: ArgumentType.STRING, defaultValue: "基准方块" } },
  def: function({NAME}) {
      if(!window.voxelWorld) return;
      const mesh = meshes.get(Cast.toString(NAME).replace(/,/g, "").trim()); if (!mesh) return;
      let transforms = new Float32Array(window.voxelWorld.size * 3), colors = new Float32Array(window.voxelWorld.size * 4), i = 0;
      for (let [key, color] of window.voxelWorld.entries()) {
          let coords = key.split("_");
          transforms[i*3] = parseInt(coords[0]); transforms[i*3+1] = parseInt(coords[1]); transforms[i*3+2] = parseInt(coords[2]);
          colors[i*4] = color.r; colors[i*4+1] = color.g; colors[i*4+2] = color.b; colors[i*4+3] = color.a; i++;
      }
      uploadBuffer(mesh, "instanceTransforms", transforms, 3, 1); uploadBuffer(mesh, "instanceColors", colors, 4, 1);
  }
},

      // === 新增代码 3: 两个新的积木定义 ===
    {
        opcode: "createBuiltInPrimitive",
        blockType: BlockType.COMMAND,
        text: "⚡快速创建模型 [NAME] 形状为 [SHAPE] 分辨率 [DETAIL]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "预置模型" },
          SHAPE: { type: ArgumentType.STRING, menu: "primitiveShapes", defaultValue: "sphere" },
          DETAIL: { type: ArgumentType.NUMBER, defaultValue: 24 }
        },
        def: function ({ NAME, SHAPE, DETAIL }) {
          NAME = Cast.toString(NAME).replace(/,/g, "").trim();
          if (NAME.length == 0) return;
          meshes.get(NAME)?.destroy();
          const mesh = new Mesh(NAME);
          meshes.set(NAME, mesh);
          
          let res = Math.max(3, Math.floor(Cast.toNumber(DETAIL)));
          let data;
          if (SHAPE === "cube") data = PrimitiveGen.createCube();
          else if (SHAPE === "sphere") data = PrimitiveGen.createSphere(1, res, res); // 默认半径设为1，大小可通过 matScale 缩放
          
          if (data) {
            uploadBuffer(mesh, "position", data.p, 3, 0); // 写入坐标
            //uploadBuffer(mesh, "colors", new Uint8Array([255, 255, 255, 255]), 4, 0);
            uploadBuffer(mesh, "texCoords", data.uv, 2, 0); // 写入UV贴图
            uploadBuffer(mesh, "indices", data.i, 1, -1, gl.ELEMENT_ARRAY_BUFFER); // 写入顶点连接顺序
            uploadBuffer(mesh, "instanceTransforms", new Float32Array([0, 0, 0]), 3, 1);
        }
        }
      },
      {
        opcode: "matLookAt",
        blockType: BlockType.COMMAND,
        text: "🎥设置摄影机视角 位于 X:[EX] Y:[EY] Z:[EZ] 看向目标 X:[TX] Y:[TY] Z:[TZ]",
        arguments: {
          EX: { type: ArgumentType.NUMBER, defaultValue: 0 }, EY: { type: ArgumentType.NUMBER, defaultValue: 50 }, EZ: { type: ArgumentType.NUMBER, defaultValue: 200 },
          TX: { type: ArgumentType.NUMBER, defaultValue: 0 }, TY: { type: ArgumentType.NUMBER, defaultValue: 0 }, TZ: { type: ArgumentType.NUMBER, defaultValue: 0 },
        },
        def: function ({ EX, EY, EZ, TX, TY, TZ }) {
          const cameraPos = [Cast.toNumber(EX), Cast.toNumber(EY), Cast.toNumber(EZ)];
          const targetPos = [Cast.toNumber(TX), Cast.toNumber(TY), Cast.toNumber(TZ)];
          const up = [0, 1, 0]; // 默认摄影机正上方为 Y轴正方向
          const cameraMat = m4.lookAt(cameraPos, targetPos, up);
          // 图形学规则：视图矩阵是摄影机矩阵的逆矩阵
          transforms[selectedTransform] = m4.inverse(cameraMat); 
        },
      },
      // === 补丁代码: 初始化单位矩阵 ===
      {
        opcode: "matIdentity",
        blockType: BlockType.COMMAND,
        text: "初始化无变换 (重置矩阵)",
        def: function () {
          // 将当前选中的变换矩阵重置为单位矩阵
          transforms[selectedTransform] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
        }
      },
      {
        blockType: BlockType.LABEL,
        text: "清除",
      },
      {
        opcode: "resetEverything",
        blockType: BlockType.COMMAND,
        text: "重置所有 3D 设置",
        def: function () { resetEverything(); },
      },
      "---",
      {
        opcode: "clear",
        blockType: BlockType.COMMAND,
        text: "清除屏幕缓存：[LAYERS]",
        arguments: {
          LAYERS: {
            type: ArgumentType.STRING,
            menu: "clearLayers",
            defaultValue: "color and depth",
          },
        },
        def: function ({ LAYERS }) {
          if (!hasOwn(ClearLayers, LAYERS)) return;
          if (gl.getParameter(gl.DEPTH_WRITEMASK)) {
            gl.clear(ClearLayers[LAYERS]);
          } else {
            gl.depthMask(true); gl.clear(ClearLayers[LAYERS]); gl.depthMask(false);
          }
          if (currentRenderTarget === canvasRenderTarget) {
            canvasDirty = true; renderer.dirty = true; runtime.requestRedraw();
          }
        },
      },
      {
        opcode: "clearColor",
        blockType: BlockType.COMMAND,
        text: "设置背景清除颜色 R: [RED] G: [GREEN] B: [BLUE] A: [ALPHA]",
        arguments: {
          RED: { type: ArgumentType.NUMBER, defaultValue: 0.5 },
          GREEN: { type: ArgumentType.NUMBER, defaultValue: 0.5 },
          BLUE: { type: ArgumentType.NUMBER, defaultValue: 0.5 },
          ALPHA: { type: ArgumentType.NUMBER, defaultValue: 1 },
        },
        def: function ({ RED, GREEN, BLUE, ALPHA }) {
          const alpha = Cast.toNumber(ALPHA);
          gl.clearColor(Cast.toNumber(RED) * alpha, Cast.toNumber(GREEN) * alpha, Cast.toNumber(BLUE) * alpha, alpha);
        },
      },
      {
        opcode: "depth",
        blockType: BlockType.COMMAND,
        text: "设置深度测试规则为 [TEST] 并设置写入深度 [WRITE]",
        arguments: {
          TEST: { type: ArgumentType.STRING, defaultValue: "closer", menu: "depthTest" },
          WRITE: { type: ArgumentType.STRING, defaultValue: "true", menu: "onOff" },
        },
        def: function ({ TEST, WRITE }) {
          let test = Cast.toString(TEST);
          if (!hasOwn(DepthTests, test)) return;
          currentRenderTarget.setDepth(test, Cast.toBoolean(WRITE));
          currentRenderTarget.updateDepth();
        },
      },
      {
        blockType: BlockType.LABEL,
        text: "3D 模型 (Meshes)",
      },
      {
        opcode: "allMeshes",
        blockType: BlockType.REPORTER,
        text: "获取所有已创建的模型",
        disableMonitor: true,
        def: function () { return Array.from(meshes.keys()).join(","); },
      },
      {
        opcode: "createMesh",
        blockType: BlockType.COMMAND,
        text: "创建模型 [NAME]",
        arguments: { NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" } },
        def: function ({ NAME }) {
          NAME = Cast.toString(NAME).replace(/,/g, "").trim();
          if (NAME.length == 0) return;
          meshes.get(NAME)?.destroy();
          meshes.set(NAME, new Mesh(NAME));
        },
      },
      {
        opcode: "deleteMesh",
        blockType: BlockType.COMMAND,
        text: "删除模型 [NAME]",
        arguments: { NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" } },
        def: function ({ NAME }) {
          NAME = Cast.toString(NAME);
          meshes.get(NAME)?.destroy();
          meshes.delete(NAME);
        },
      },
      {
        opcode: "inheritMeshes",
        blockType: BlockType.COMMAND,
        text: "使模型 [NAME] 继承来自模型 [NAMES] 的数据",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "模型3" },
          NAMES: { type: ArgumentType.STRING, defaultValue: "模型1,模型2" },
        },
        def: function ({ NAME, NAMES }) {
          const mesh = meshes.get(Cast.toString(NAME));
          if (!mesh) return;
          const parentMeshes = Cast.toString(NAMES).split(",").map((s) => meshes.get(s.trim())).filter((m) => m);
          for (let otherMesh of parentMeshes) { if (otherMesh.dependsOn(mesh)) return; }
          for (let otherMesh of mesh.dependencies) { otherMesh.dependants.delete(mesh); }
          mesh.dependencies = new Set(parentMeshes);
          for (let otherMesh of parentMeshes) { otherMesh.dependants.add(mesh); }
          mesh.update();
        },
      },
      {
        opcode: "meshInfo",
        blockType: BlockType.REPORTER,
        text: "获取模型 [NAME] 的属性 [PROP]",
        allowDropAnywhere: true,
        arguments: {
          PROP: { type: ArgumentType.STRING, menu: "meshProperties", defaultValue: "inherits from" },
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
        },
        def: function ({ NAME, PROP }) {
          const mesh = meshes.get(Cast.toString(NAME));
          if (PROP == "exists") return !!mesh;
          if (!mesh || !hasOwn(MeshPropFns, PROP)) return "";
          return MeshPropFns[PROP](mesh) ?? "";
        },
      },
      "---",
      {
        opcode: "setMeshIndices",
        blockType: BlockType.COMMAND,
        text: "设置模型 [NAME] 顶点索引 数据源 [INDICES]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          INDICES: { type: ArgumentType.STRING, menu: "lists" },
        },
        def: function ({ NAME, INDICES }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          const value = compactIndices(target, INDICES);
          if (!mesh || !value) return;
          uploadBuffer(mesh, "indices", value, 1, -1, gl.ELEMENT_ARRAY_BUFFER);
        },
      },
      {
        opcode: "setMeshPositionsXY",
        blockType: BlockType.COMMAND,
        text: "设置模型 [NAME] XY顶点位置数据源 [X] [Y]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          X: { type: ArgumentType.STRING, menu: "lists" },
          Y: { type: ArgumentType.STRING, menu: "lists" },
        },
        def: function ({ NAME, X, Y }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          const value = compact(target, [X, Y], Float32Array);
          uploadBuffer(mesh, "position", value, 2, 0);
        },
      },
      {
        opcode: "setMeshPositionsXYZ",
        blockType: BlockType.COMMAND,
        text: "设置模型 [NAME] XYZ顶点位置数据源 [X] [Y] [Z]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          X: { type: ArgumentType.STRING, menu: "lists" },
          Y: { type: ArgumentType.STRING, menu: "lists" },
          Z: { type: ArgumentType.STRING, menu: "lists" },
        },
        def: function ({ NAME, X, Y, Z }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          const value = compact(target, [X, Y, Z], Float32Array);
          uploadBuffer(mesh, "position", value, 3, 0);
        },
      },
      {
        opcode: "setMeshColorsRGB",
        blockType: BlockType.COMMAND,
        text: "设置模型 [NAME] RGB顶点颜色数据源 [R] [G] [B]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          R: { type: ArgumentType.STRING, menu: "lists" },
          G: { type: ArgumentType.STRING, menu: "lists" },
          B: { type: ArgumentType.STRING, menu: "lists" },
        },
        def: function ({ NAME, R, G, B }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          const value = compact(target, [R, G, B], Uint8Array);
          uploadBuffer(mesh, "colors", value, 3, 0);
        },
      },
      {
        opcode: "setMeshColorsRGBA",
        blockType: BlockType.COMMAND,
        text: "设置模型 [NAME] RGBA顶点颜色数据源 [R] [G] [B] [A]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          R: { type: ArgumentType.STRING, menu: "lists" },
          G: { type: ArgumentType.STRING, menu: "lists" },
          B: { type: ArgumentType.STRING, menu: "lists" },
          A: { type: ArgumentType.STRING, menu: "lists" },
        },
        def: function ({ NAME, R, G, B, A }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          const value = compact(target, [R, G, B, A], Uint8Array);
          uploadBuffer(mesh, "colors", value, 4, 0);
        },
      },
      {
        opcode: "setMeshTexCoordUV",
        blockType: BlockType.COMMAND,
        text: "设置模型 [NAME] UV贴图坐标数据源 [U] [V]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          U: { type: ArgumentType.STRING, menu: "lists" },
          V: { type: ArgumentType.STRING, menu: "lists" },
        },
        def: function ({ NAME, U, V }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          const value = compact(target, [U, V], Float32Array);
          if (!mesh || !value) return;
          uploadBuffer(mesh, "texCoords", value, 2, 0);
        },
      },
      {
        opcode: "setMeshTexture",
        blockType: BlockType.COMMAND,
        text: "为模型 [NAME] 设置贴图图像 [TEXTURE] 边缘处理模式 [WRAP] 过滤模式 [FILTER]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          TEXTURE: { type: null },
          WRAP: { type: ArgumentType.STRING, menu: "textureWrap" },
          FILTER: { type: ArgumentType.STRING, menu: "textureFilter" },
        },
        def: function ({ NAME, TEXTURE, WRAP, FILTER }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          if (!mesh) return;
          const texture = Cast.toString(TEXTURE);
          if (texture !== "[texture data]") return;
          const wrap = Cast.toString(WRAP) == "repeat" ? gl.REPEAT : gl.CLAMP_TO_EDGE;
          const filter = Cast.toString(FILTER) == "blurred" ? gl.LINEAR : gl.NEAREST;
          let textureObj = mesh.myData.texture ?? (mesh.myData.texture = new Texture2D(mesh));
          if (!(textureObj instanceof Texture2D)) return;
          textureObj.main.loading = true;
          textureObj.main.failedToLoad = false;
          mesh.update();
          const onData = function (data) {
            if (data == null || mesh.destroyed) {
              textureObj.main.loading = false; textureObj.main.failedToLoad = true; return;
            }
            textureObj.main.setTexture(data.data, data.width, data.height, wrap, filter);
          };
          if (imageSourceSync) onData(imageSourceSync); else imageSource.then(onData);
        },
      },
      {
        opcode: "setMeshTexCoordUVW",
        blockType: BlockType.COMMAND,
        text: "设置模型 [NAME] 立方体纹理UVW贴图坐标 [U] [V] [W]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          U: { type: ArgumentType.STRING, menu: "lists" },
          V: { type: ArgumentType.STRING, menu: "lists" },
          W: { type: ArgumentType.STRING, menu: "lists" },
        },
        def: function ({ NAME, U, V, W }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          const value = compact(target, [U, V, W], Float32Array);
          uploadBuffer(mesh, "texCoords", value, 3, 0);
        },
      },
      {
        opcode: "setMeshCubeTexture",
        blockType: BlockType.COMMAND,
        text: "为模型 [NAME] 立方体纹理的 [SIDE] 面设置贴图 [TEXTURE] 边缘模式 [WRAP] 过滤 [FILTER]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          SIDE: { type: ArgumentType.STRING, menu: "cubeSide" },
          TEXTURE: { type: null },
          WRAP: { type: ArgumentType.STRING, menu: "textureWrap" },
          FILTER: { type: ArgumentType.STRING, menu: "textureFilter" },
        },
        def: function ({ NAME, SIDE, TEXTURE, WRAP, FILTER }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          if (!mesh) return;
          const texture = Cast.toString(TEXTURE);
          if (texture !== "[texture data]") return;
          const wrap = Cast.toString(WRAP) == "repeat" ? gl.REPEAT : gl.CLAMP_TO_EDGE;
          const filter = Cast.toString(FILTER) == "blurred" ? gl.LINEAR : gl.NEAREST;
          let textureObj = mesh.myData.texture ?? (mesh.myData.texture = new TextureCube(mesh));
          if (!(textureObj instanceof TextureCube)) return;
          const lookup = { "X+": "xpos", "X-": "xneg", "Y+": "ypos", "Y-": "yneg", "Z+": "zpos", "Z-": "zneg" };
          if (!hasOwn(lookup, SIDE)) return;
          textureObj[lookup[SIDE]].loading = true;
          textureObj[lookup[SIDE]].failedToLoad = false;
          mesh.update();
          const onData = function (data) {
            if (data == null || mesh.destroyed) {
              textureObj[lookup[SIDE]].loading = false; textureObj[lookup[SIDE]].failedToLoad = true; return;
            }
            textureObj[lookup[SIDE]].setTexture(data.data, data.width, data.height, wrap, filter);
          };
          if (imageSourceSync) onData(imageSourceSync); else imageSource.then(onData);
        },
      },
      {
        opcode: "setMeshTextureMipmap",
        blockType: BlockType.COMMAND,
        text: "设置模型 [NAME] 贴图多级渐远(Mipmapping) [MIPMAPPING]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          MIPMAPPING: { type: ArgumentType.STRING, menu: "textureMipmapping" },
        },
        def: function ({ NAME, MIPMAPPING }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          if (!mesh || !mesh.myData.texture) return;
          if (MIPMAPPING == "off") mesh.myData.texture.setMipmapState(false, gl.NEAREST);
          if (MIPMAPPING == "sharp transitions") mesh.myData.texture.setMipmapState(true, gl.NEAREST);
          if (MIPMAPPING == "smooth transitions") mesh.myData.texture.setMipmapState(true, gl.LINEAR);
        },
      },
      {
        opcode: "setMeshTextureAnisotropy",
        blockType: BlockType.COMMAND,
        text: "设置模型 [NAME] 贴图各向异性过滤强度为 [ANISOTROPY]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          ANISOTROPY: { type: ArgumentType.STRING, menu: "powersOfTwo", defaultValue: 16 },
        },
        def: function ({ NAME, ANISOTROPY }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          if (!mesh || !mesh.myData.texture) return;
          mesh.myData.texture.setAnisotropy(Math.max(1, Math.round(Cast.toNumber(ANISOTROPY))));
        },
      },
      {
        opcode: "setMeshWeights",
        blockType: BlockType.COMMAND,
        text: "设置模型 [NAME] 骨骼索引数据源 [INDICES] 骨骼权重 [WEIGHTS] 每顶点连接骨骼数 [COUNT]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          INDICES: { type: ArgumentType.STRING, menu: "lists" },
          WEIGHTS: { type: ArgumentType.STRING, menu: "lists" },
          COUNT: { type: ArgumentType.NUMBER, defaultValue: 3 },
        },
        def: function ({ NAME, INDICES, WEIGHTS, COUNT }, { target }) {
          COUNT = Math.floor(Cast.toNumber(COUNT));
          if (COUNT < 1 || COUNT > 4) return;
          const mesh = meshes.get(Cast.toString(NAME));
          let valueI = compact(target, [INDICES], Uint8Array), valueW;
          if (!mesh || !valueI || valueI.length % COUNT > 0) return;
          if (COUNT > 1) {
            valueW = compact(target, [WEIGHTS], Uint16Array, 65535);
            if (!valueW || valueW.length % COUNT > 0 || valueW.length !== valueI.length) return;
          }
          uploadBuffer(mesh, "boneIndices", valueI, COUNT, 0);
          if (COUNT > 1) uploadBuffer(mesh, "boneWeights", valueW, COUNT, 0);
        },
      },
      {
        opcode: "setMeshTransforms",
        blockType: BlockType.COMMAND,
        text: "设置模型 [NAME] 的 [TRANSFORMS] 变换矩阵列表源 [MATRIXES]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          TRANSFORMS: { type: ArgumentType.STRING, menu: "skinningTransforms" },
          MATRIXES: { type: ArgumentType.STRING, menu: "lists" },
        },
        def: function ({ NAME, TRANSFORMS, MATRIXES }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          const myData = mesh.myData;
          const list = target.lookupVariableByNameAndType(Cast.toString(MATRIXES), "list");
          if (!mesh || !list) return;
          const value = list.value.map(Cast.toNumber);
  
          if (TRANSFORMS == "original") {
            myData.bonesOrig = chunkArray(value, 16).map(m4.inverse);
            if (!myData.bonesCurr) {
              if (myData.bonesCurrRaw) { myData.bonesCurr = chunkArray(myData.bonesCurrRaw, 16); myData.bonesCurrRaw = null; } 
              else { myData.bonesCurr = chunkArray(value, 16); }
            }
          }
          if (TRANSFORMS == "current") {
            if (myData.bonesOrig) { myData.bonesCurr = chunkArray(value, 16); myData.bonesCurrRaw = null; } 
            else { myData.bonesCurrRaw = value; }
          }
          if (myData.bonesOrig) {
            const diff = [];
            const end = Math.min(myData.bonesCurr.length, myData.bonesOrig.length);
            let i = 0;
            for (; i < end; i++) diff.push(m4.multiply(myData.bonesCurr[i], myData.bonesOrig[i]));
            for (; i < myData.bonesCurr.length; i++) diff.push(myData.bonesCurr[i]);
            myData.bonesDiff = diff.flat();
          } else {
            myData.bonesDiff = myData.bonesCurrRaw;
          }
          mesh.update();
        },
      },
      {
        opcode: "setMeshInterleaved",
        blockType: BlockType.COMMAND,
        text: "合并提交：设置模型 [NAME] 交错模式数据 [PROPERTY] 列表源 [SRCLIST]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          PROPERTY: { type: ArgumentType.STRING, menu: "interleavedProperty" },
          SRCLIST: { type: ArgumentType.STRING, menu: "lists" },
        },
        def: function ({ NAME, PROPERTY, SRCLIST }, { target }) {
          let bufferName, size, type;
          if (PROPERTY == "XY positions") { bufferName = "position"; size = 2; type = Float32Array; }
          if (PROPERTY == "XYZ positions") { bufferName = "position"; size = 3; type = Float32Array; }
          if (PROPERTY == "RGB colors") { bufferName = "colors"; size = 3; type = Uint8Array; }
          if (PROPERTY == "RGBA colors") { bufferName = "colors"; size = 4; type = Uint8Array; }
          if (PROPERTY == "UV texture coordinates") { bufferName = "texCoords"; size = 2; type = Float32Array; }
          if (PROPERTY == "UVW texture coordinates") { bufferName = "texCoords"; size = 3; type = Float32Array; }
          if (!bufferName) return;
          const mesh = meshes.get(Cast.toString(NAME));
          const value = compact(target, [SRCLIST], type);
          uploadBuffer(mesh, bufferName, value, size, 0);
        },
      },
      {
        opcode: "setMeshInstances",
        blockType: BlockType.COMMAND,
        text: "💥 GPU实例化：将模型 [NAME] 的 [PROPERTY] 配置为数据源 [SRCLIST]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          PROPERTY: { type: ArgumentType.STRING, menu: "instanceProperty" },
          SRCLIST: { type: ArgumentType.STRING, menu: "lists" },
        },
        def: function ({ NAME, PROPERTY, SRCLIST }, { target }) {
          let bufferName, size, type;
          if (PROPERTY == "transforms") { bufferName = "instanceTransforms"; size = 16; type = Float32Array; }
          if (PROPERTY == "XY positions") { bufferName = "instanceTransforms"; size = 2; type = Float32Array; }
          if (PROPERTY == "XYZ positions") { bufferName = "instanceTransforms"; size = 3; type = Float32Array; }
          if (PROPERTY == "XYZ positions and sizes") { bufferName = "instanceTransforms"; size = 4; type = Float32Array; }
          if (PROPERTY == "RGB colors") { bufferName = "instanceColors"; size = 3; type = Float32Array; }
          if (PROPERTY == "RGBA colors") { bufferName = "instanceColors"; size = 4; type = Float32Array; }
          if (PROPERTY == "UV offsets") { bufferName = "instanceUVOffsets"; size = 2; type = Float32Array; }
          if (PROPERTY == "UV offsets and sizes") { bufferName = "instanceUVOffsets"; size = 4; type = Float32Array; }
          if (!bufferName) return;
          const mesh = meshes.get(Cast.toString(NAME));
          const value = compact(target, [SRCLIST], type);
          uploadBuffer(mesh, bufferName, value, size, 1);
        },
      },
      {
        opcode: "setMeshUploadOffset",
        blockType: BlockType.COMMAND,
        text: "设置模型 [NAME] 数据上传至显卡的偏移位置 (Offset) 为 [OFFSET]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          OFFSET: { type: ArgumentType.NUMBER, defaultValue: 1 },
        },
        def: function ({ NAME, OFFSET }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          if (!mesh) return;
          mesh.uploadOffset = Cast.toNumber(OFFSET) - 1;
        },
      },
      {
        opcode: "setBufferUsageHint",
        text: "显存优化：告知显卡模型 [NAME] 的更新频率为 [USAGE]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          USAGE: { type: ArgumentType.STRING, menu: "bufferUsage", defaultValue: "rarely" },
        },
        def: function ({ NAME, USAGE }) {
          const mesh = meshes.get(Cast.toString(NAME));
          if (!mesh) return;
          if (USAGE == "rarely") mesh.uploadUsage = gl.STATIC_DRAW;
          if (USAGE == "frequently fully") mesh.uploadUsage = gl.STREAM_DRAW;
          if (USAGE == "frequently partially") mesh.uploadUsage = gl.DYNAMIC_DRAW;
        },
      },
      {
        opcode: "setMeshFromFile",
        blockType: BlockType.COMMAND,
        text: "解析导入：利用包含 [FILETYPE] 数据的列表 [SRCLIST] 生成模型 [NAME]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          FILETYPE: { type: ArgumentType.STRING, menu: "filetype" },
          SRCLIST: { type: ArgumentType.STRING, menu: "lists" },
        },
        def: function ({ NAME, FILETYPE, SRCLIST }, { target }) {
          (async function () {
            const mesh = meshes.get(Cast.toString(NAME));
            const list = target.lookupVariableByNameAndType(SRCLIST, "list");
            if (!mesh || !list) return;
            let output = await modelDecoder.decode(FILETYPE, list.value.slice(), transforms.import);
            if (!output) return;
            if (output.xyz) { const value = new Float32Array(output.xyz); uploadBuffer(mesh, "position", value, 3, 0); }
            if (output.rgba) { const value = new Uint8Array(output.rgba); uploadBuffer(mesh, "colors", value, 4, 0); }
            if (output.uv) { const value = new Float32Array(output.uv); uploadBuffer(mesh, "texCoords", value, 2, 0); }
          })();
        },
      },
      {
        opcode: "setMeshPrimitives",
        blockType: BlockType.COMMAND,
        text: "设置模型 [NAME] 的图元渲染类型为 [PRIMITIVES]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          PRIMITIVES: { type: ArgumentType.STRING, menu: "primitives" },
        },
        def: function ({ NAME, PRIMITIVES }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          const primitivesName = Cast.toString(PRIMITIVES);
          if (!mesh || !hasOwn(Primitives, primitivesName)) return;
          mesh.myData.primitives = Primitives[primitivesName];
          mesh.myData.primitivesName = primitivesName;
          mesh.update();
        },
      },
      {
        opcode: "setMeshBlending",
        blockType: BlockType.COMMAND,
        text: "设置模型 [NAME] 材质透明混合模式为 [BLENDING]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          BLENDING: { type: ArgumentType.STRING, menu: "blending", defaultValue: "default" },
        },
        def: function ({ NAME, BLENDING }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          const blending = Cast.toString(BLENDING);
          if (!mesh || !hasOwn(Blendings, blending)) return;
          mesh.myData.blending = blending;
          mesh.update();
        },
      },
      {
        opcode: "setMeshCulling",
        blockType: BlockType.COMMAND,
        text: "设置模型 [NAME] 面剔除(Culling)方向为 [CULLING]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          CULLING: { type: ArgumentType.STRING, menu: "culling" },
        },
        def: function ({ NAME, CULLING }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          const culling = Cast.toString(CULLING);
          if (!mesh || !hasOwn(Cullings, culling)) return;
          mesh.myData.culling = culling;
          mesh.update();
        },
      },
      {
        opcode: "setMeshAlphaTest",
        blockType: BlockType.COMMAND,
        text: "设置模型 [NAME] 丢弃 Alpha 透明度低于 [ALPHATEST] 的像素，对于留下的像素 [MAKEOPAQUE]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          ALPHATEST: { type: ArgumentType.STRING, defaultValue: 0.5 },
          MAKEOPAQUE: { type: ArgumentType.STRING, menu: "alphaTestMode", defaultValue: "true" },
        },
        def: function ({ NAME, ALPHATEST, MAKEOPAQUE }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          if (!mesh) return;
          mesh.myData.alphaTest = Cast.toNumber(ALPHATEST);
          mesh.myData.makeOpaque = Cast.toBoolean(MAKEOPAQUE);
          mesh.update();
        },
      },
      {
        opcode: "setMeshBillboarding",
        blockType: BlockType.COMMAND,
        text: "设置模型 [NAME] 广告牌(永远面向屏幕)模式 [BILLBOARDING]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          BILLBOARDING: { type: ArgumentType.STRING, menu: "onOff" },
        },
        def: function ({ NAME, BILLBOARDING }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          if (!mesh) return;
          mesh.myData.billboarding = Cast.toBoolean(BILLBOARDING);
          mesh.update();
        },
      },
      {
        opcode: "setMeshCentroidInterpolation",
        blockType: BlockType.COMMAND,
        text: "设置模型 [NAME] 开启质心抗锯齿插值 [USECENTROID]",
        hideFromPalette: true,
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          USECENTROID: { type: ArgumentType.STRING, menu: "onOff" },
        },
        def: function ({ NAME, USECENTROID }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          if (!mesh) return;
          mesh.myData.interpolation = Cast.toBoolean(USECENTROID) ? "MSAA_CENTROID" : "";
          mesh.update();
        },
      },
      {
        opcode: "setMeshMultiSampleInterpolation",
        blockType: BlockType.COMMAND,
        text: "设置模型 [NAME] 多重抗锯齿采样颜色插值算法为 [MODE]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          MODE: { type: ArgumentType.STRING, menu: "multiSampleInterpolation" },
        },
        def: function ({ NAME, MODE }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          if (!mesh) return;
          if (MODE === "once at pixel center") mesh.myData.interpolation = "";
          if (MODE === "once at midpoint of covered samples") mesh.myData.interpolation = "MSAA_CENTROID";
          if (MODE === "separately for each sample" && ext_smi) mesh.myData.interpolation = "MSAA_SAMPLE";
          mesh.update();
        },
      },
      {
        opcode: "setMeshDrawRange",
        blockType: BlockType.COMMAND,
        text: "设置模型 [NAME] 的绘制限制区间，从第 [START] 个绘制到第 [END] 个顶点",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          START: { type: ArgumentType.NUMBER, defaultValue: 1 },
          END: { type: ArgumentType.NUMBER, defaultValue: 6 },
        },
        def: function ({ NAME, START, END }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          if (!mesh) return;
          const start = Math.max(1, Math.floor(Cast.toNumber(START))) - 1;
          const end = Math.max(0, Math.floor(Cast.toNumber(END)));
          mesh.myData.drawRange = [start, Math.max(0, end - start)];
          mesh.update();
        },
      },
      {
        opcode: "setMeshInstanceLimit",
        blockType: BlockType.COMMAND,
        text: "设置模型 [NAME] 实例化绘制的最大数量上限 [END]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          END: { type: ArgumentType.NUMBER, defaultValue: 10 },
        },
        def: function ({ NAME, END }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          if (!mesh) return;
          let end = Math.floor(Cast.toNumber(END));
          if (end < 1) end = Infinity;
          mesh.myData.maxInstances = end;
          mesh.update();
        },
      },
      {
        opcode: "setMeshTexCoordOffsetUV",
        blockType: BlockType.COMMAND,
        text: "设置模型 [NAME] 贴图 UV 滚动偏移 U: [U] V: [V]",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
          U: { type: ArgumentType.NUMBER }, V: { type: ArgumentType.NUMBER },
        },
        def: function ({ NAME, U, V }, { target }) {
          const mesh = meshes.get(Cast.toString(NAME));
          if (!mesh) return;
          mesh.myData.uvOffset = [Cast.toNumber(U), Cast.toNumber(V)];
          mesh.update();
        },
      },
      {
        opcode: "drawMesh",
        blockType: BlockType.COMMAND,
        text: "💥渲染提交：把模型 [NAME] 画出来！",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
        },
        def: function ({ NAME }, util) {
          NAME = Cast.toString(NAME);
          const mesh = meshes.get(NAME);
          if (!mesh || !currentRenderTarget.checkIfValid() || currentRenderTarget.getMesh() == mesh || !mesh.buffers.position) return;
  
          let length = -1; let lengthIns = -1;
          for (const name in mesh.buffers) {
            const buffer = mesh.buffers[name];
            if (buffer.type == 0) { if (length == -1) length = buffer.length; else if (length !== buffer.length) return; } 
            else if (buffer.type == 1) { if (lengthIns == -1) lengthIns = buffer.length; else if (lengthIns !== buffer.length) return; }
          }
          if (length == -1) return;
  
          let flags = [];
          if (mesh.buffers.colors) flags.push("COLORS");
          if (mesh.buffers.texCoords) flags.push(`TEXTURES ${mesh.buffers.texCoords.size}`);
          if (fogEnabled) {
            flags.push("FOG");
            if (fogSpace == "view space") flags.push("FOG_IN_VIEW_SPACE");
            if (fogSpace == "world space") flags.push("FOG_IN_WORLD_SPACE");
            if (fogSpace == "model space") flags.push("FOG_IN_MODEL_SPACE");
            if (fogPosition) flags.push("FOG_POS");
          }
          if (mesh.buffers.boneIndices && mesh.data.bonesDiff) {
            flags.push(`SKINNING ${mesh.buffers.boneIndices.size}`);
            flags.push(`BONE_COUNT ${mesh.data.bonesDiff.length / 16}`);
          }
          if (mesh.data.interpolation) flags.push(mesh.data.interpolation);
          if (mesh.data.alphaTest > 0) flags.push("ALPHATEST");
          if (mesh.data.makeOpaque) flags.push("MAKE_OPAQUE");
          if (mesh.data.billboarding) flags.push("BILLBOARD");
          if (mesh.data.uvOffset) flags.push("UV_OFFSET");
          if (mesh.buffers.instanceTransforms) {
            flags.push("INSTANCING");
            if (mesh.buffers.instanceTransforms.size <= 3) flags.push("INSTANCE_POS");
            if (mesh.buffers.instanceTransforms.size == 4) flags.push("INSTANCE_POS_SCALE");
            if (mesh.buffers.instanceTransforms.size == 16) flags.push("INSTANCE_MATRIX");
          }
          if (mesh.buffers.instanceColors) flags.push("INSTANCE_COLOR");
          if (mesh.buffers.instanceUVOffsets) flags.push(mesh.buffers.instanceUVOffsets.size == 4 ? "INSTANCE_UVS" : "INSTANCE_UV");
          
          const program = programs.get(flags);
          if (!program.program) return;
          gl.useProgram(program.program);
  
          if (mesh.buffers.indices) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.buffers.indices.buffer);
  
          gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.position.buffer);
          gl.enableVertexAttribArray(program.aloc.a_position);
          gl.vertexAttribPointer(program.aloc.a_position, mesh.buffers.position.size, gl.FLOAT, false, 0, 0);
  
          if (mesh.buffers.colors) {
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.colors.buffer);
            gl.enableVertexAttribArray(program.aloc.a_color);
            gl.vertexAttribPointer(program.aloc.a_color, mesh.buffers.colors.size, gl.UNSIGNED_BYTE, true, 0, 0);
          }
          if (mesh.buffers.texCoords) {
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.texCoords.buffer);
            gl.enableVertexAttribArray(program.aloc.a_uv);
            gl.vertexAttribPointer(program.aloc.a_uv, mesh.buffers.texCoords.size, gl.FLOAT, false, 0, 0);
          }
          if (mesh.buffers.boneIndices) {
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.boneIndices.buffer);
            gl.enableVertexAttribArray(program.aloc.a_index);
            gl.vertexAttribPointer(program.aloc.a_index, mesh.buffers.boneIndices.size, gl.BYTE, false, 0, 0);
          }
          if (mesh.buffers.boneWeights) {
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.boneWeights.buffer);
            gl.enableVertexAttribArray(program.aloc.a_weight);
            gl.vertexAttribPointer(program.aloc.a_weight, mesh.buffers.boneWeights.size, gl.UNSIGNED_SHORT, true, 0, 0);
          }
          if (mesh.buffers.instanceTransforms) {
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.instanceTransforms.buffer);
            if (mesh.buffers.instanceTransforms.size == 16) {
              gl.enableVertexAttribArray(program.aloc.a_instanceTransform);
              gl.enableVertexAttribArray(program.aloc.a_instanceTransform + 1);
              gl.enableVertexAttribArray(program.aloc.a_instanceTransform + 2);
              gl.enableVertexAttribArray(program.aloc.a_instanceTransform + 3);
              gl.vertexAttribPointer(program.aloc.a_instanceTransform, 4, gl.FLOAT, false, 64, 0);
              gl.vertexAttribPointer(program.aloc.a_instanceTransform + 1, 4, gl.FLOAT, false, 64, 16);
              gl.vertexAttribPointer(program.aloc.a_instanceTransform + 2, 4, gl.FLOAT, false, 64, 32);
              gl.vertexAttribPointer(program.aloc.a_instanceTransform + 3, 4, gl.FLOAT, false, 64, 48);
              gl.vertexAttribDivisor(program.aloc.a_instanceTransform, 1);
              gl.vertexAttribDivisor(program.aloc.a_instanceTransform + 1, 1);
              gl.vertexAttribDivisor(program.aloc.a_instanceTransform + 2, 1);
              gl.vertexAttribDivisor(program.aloc.a_instanceTransform + 3, 1);
            } else {
              gl.enableVertexAttribArray(program.aloc.a_instanceTransform);
              gl.vertexAttribPointer(program.aloc.a_instanceTransform, mesh.buffers.instanceTransforms.size, gl.FLOAT, false, 0, 0);
              gl.vertexAttribDivisor(program.aloc.a_instanceTransform, 1);
            }
          }
          if (mesh.buffers.instanceColors) {
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.instanceColors.buffer);
            gl.enableVertexAttribArray(program.aloc.a_instanceColor);
            gl.vertexAttribPointer(program.aloc.a_instanceColor, mesh.buffers.instanceColors.size, gl.FLOAT, false, 0, 0);
            gl.vertexAttribDivisor(program.aloc.a_instanceColor, 1);
          }
          if (mesh.buffers.instanceUVOffsets) {
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.instanceUVOffsets.buffer);
            gl.enableVertexAttribArray(program.aloc.a_instanceUV);
            gl.vertexAttribPointer(program.aloc.a_instanceUV, mesh.buffers.instanceUVOffsets.size, gl.FLOAT, false, 0, 0);
            gl.vertexAttribDivisor(program.aloc.a_instanceUV, 1);
          }
  
          const blending = mesh.data.blending ?? "default";
          if (blending !== currentBlending) {
            currentBlending = blending;
            const props = Blendings[blending];
            if (props[0] !== currentBlendingProps[0]) {
              if (props[0]) gl.enable(gl.BLEND); else gl.disable(gl.BLEND);
              currentBlendingProps[0] = props[0];
            }
            if (props[0]) {
              gl.blendFuncSeparate(props[1], props[2], props[3], props[4]);
              if (props[5] !== currentBlendingProps[5]) {
                gl.blendEquation(props[5]); currentBlendingProps[5] = props[5];
              }
            }
          }
          const culling = mesh.data.culling ?? "nothing";
          if (culling !== currentCulling) {
            currentCulling = culling;
            const props = Cullings[culling];
            if (props[0] !== currentCullingProps[0]) {
              if (props[0]) gl.enable(gl.CULL_FACE); else gl.disable(gl.CULL_FACE);
              currentCullingProps[0] = props[0];
            }
            if (props[0]) {
              if (props[1] !== currentCullingProps[1]) {
                gl.cullFace(props[1]); currentCullingProps[1] = props[1];
              }
            }
          }
  
          if (mesh.buffers.texCoords) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(mesh.data.texture?.target ?? gl.TEXTURE_2D, mesh.data.texture?.texture ?? texture);
            gl.uniform1i(program.uloc.u_texture, 0);
          }
  
          gl.uniform4fv(program.uloc.u_color_mul, colorMultiplier);
          gl.uniform4fv(program.uloc.u_color_add, colorAdder);
          // === 新增：将光影参数喂给 GPU ===
          if (program.uloc.u_use_lighting !== undefined) gl.uniform1f(program.uloc.u_use_lighting, lightEnabled);
          if (program.uloc.u_light_dir !== undefined) gl.uniform3fv(program.uloc.u_light_dir, lightDir);
          if (program.uloc.u_light_color !== undefined) gl.uniform3fv(program.uloc.u_light_color, lightColor);
          if (program.uloc.u_ambient_color !== undefined) gl.uniform3fv(program.uloc.u_ambient_color, ambientColor);
          if (fogEnabled) {
            gl.uniform3fv(program.uloc.u_fog_color, fogColor);
            gl.uniform2fv(program.uloc.u_fog_dist, fogDistance);
            if (fogPosition) gl.uniform3fv(program.uloc.u_fog_position, fogPosition);
          }
          if (mesh.data.alphaTest > 0) { gl.uniform1f(program.uloc.u_alpha_threshold, mesh.data.alphaTest); }
  
          if (mesh.data.bonesDiff) { gl.uniformMatrix4fv(program.uloc.u_bones, false, mesh.data.bonesDiff); }
          if (mesh.data.uvOffset) { gl.uniform2fv(program.uloc.u_uvOffset, mesh.data.uvOffset); }
  
          gl.uniformMatrix4fv(program.uloc.u_projection, false, transforms.viewToProjected);
          gl.uniformMatrix4fv(program.uloc.u_view, false, transforms.worldToView);
          gl.uniformMatrix4fv(program.uloc.u_model, false, transforms.modelToWorld);
  
          let start = 0;
          let amount = mesh.buffers.indices ? mesh.buffers.indices.length : length;
          if (mesh.data.drawRange) {
            const size = mesh.buffers.indices ? mesh.buffers.indices.bytesPerEl : 1;
            start = mesh.data.drawRange[0] * size;
            const end = Math.min(mesh.data.drawRange[0] + mesh.data.drawRange[1], amount);
            amount = end - mesh.data.drawRange[0];
          }
          if (mesh.buffers.instanceTransforms) {
            let instanceCount = mesh.buffers.instanceTransforms.length;
            if (mesh.data.maxInstances && mesh.data.maxInstances < instanceCount) { instanceCount = mesh.data.maxInstances; }
            if (mesh.buffers.indices) {
              const indexTypes = [null, gl.UNSIGNED_BYTE, gl.UNSIGNED_SHORT, null, gl.UNSIGNED_INT];
              gl.drawElementsInstanced(mesh.data.primitives ?? gl.TRIANGLES, amount, indexTypes[mesh.buffers.indices.bytesPerEl], start, instanceCount);
            } else {
              gl.drawArraysInstanced(mesh.data.primitives ?? gl.TRIANGLES, start, amount, instanceCount);
            }
          } else {
            if (mesh.buffers.indices) {
              const indexTypes = [null, gl.UNSIGNED_BYTE, gl.UNSIGNED_SHORT, null, gl.UNSIGNED_INT];
              gl.drawElements(mesh.data.primitives ?? gl.TRIANGLES, amount, indexTypes[mesh.buffers.indices.bytesPerEl], start);
            } else {
              gl.drawArrays(mesh.data.primitives ?? gl.TRIANGLES, start, amount);
            }
          }
          if (currentRenderTarget === canvasRenderTarget) {
            canvasDirty = true; renderer.dirty = true; runtime.requestRedraw();
          }
  
          if (mesh.buffers.colors) gl.disableVertexAttribArray(program.aloc.a_color);
          if (mesh.buffers.texCoords) gl.disableVertexAttribArray(program.aloc.a_uv);
          if (mesh.buffers.boneIndices) gl.disableVertexAttribArray(program.aloc.a_index);
          if (mesh.buffers.boneWeights) gl.disableVertexAttribArray(program.aloc.a_weight);
          if (mesh.buffers.instanceTransforms) {
            if (mesh.buffers.instanceTransforms.size == 16) {
              gl.disableVertexAttribArray(program.aloc.a_instanceTransform);
              gl.disableVertexAttribArray(program.aloc.a_instanceTransform + 1);
              gl.disableVertexAttribArray(program.aloc.a_instanceTransform + 2);
              gl.disableVertexAttribArray(program.aloc.a_instanceTransform + 3);
              gl.vertexAttribDivisor(program.aloc.a_instanceTransform, 0);
              gl.vertexAttribDivisor(program.aloc.a_instanceTransform + 1, 0);
              gl.vertexAttribDivisor(program.aloc.a_instanceTransform + 2, 0);
              gl.vertexAttribDivisor(program.aloc.a_instanceTransform + 3, 0);
            } else {
              gl.disableVertexAttribArray(program.aloc.a_instanceTransform);
              gl.vertexAttribDivisor(program.aloc.a_instanceTransform, 0);
            }
          }
          if (mesh.buffers.instanceColors) { gl.disableVertexAttribArray(program.aloc.a_instanceColor); gl.vertexAttribDivisor(program.aloc.a_instanceColor, 0); }
          if (mesh.buffers.instanceUVOffsets) { gl.disableVertexAttribArray(program.aloc.a_instanceUV); gl.vertexAttribDivisor(program.aloc.a_instanceUV, 0); }
        },
      },
      {
        blockType: BlockType.LABEL,
        text: "贴图生成与加载 (Textures)",
      },
      {
        opcode: "textureFromUrl",
        blockType: BlockType.REPORTER,
        text: "从网址 [TEXURL] 加载外部贴图",
        arguments: {
          TEXURL: { type: ArgumentType.STRING, defaultValue: "https://extensions.turbowarp.org/dango.png" },
        },
        def: function ({ TEXURL }, { target }) {
          imageSourceSync = null;
          imageSource = new Promise((resolve, reject) => {
            Scratch.canFetch(TEXURL)
              .then((result) => {
                if (!result) { resolve(null); return; }
                const img = new Image();
                if (new URL(TEXURL, window.location.href).origin !== window.location.origin) img.crossOrigin = "";
                img.src = TEXURL;
                img.onload = function () { resolve({ width: img.width, height: img.height, data: img }); };
                img.onerror = function () { resolve(null); };
              })
              .catch(() => { resolve(null); });
          });
          return "[texture data]";
        },
      },
      {
        opcode: "textureFromCostume",
        blockType: BlockType.REPORTER,
        text: "将当前角色的造型 [NAME] 作为贴图",
        arguments: {
          NAME: { type: ArgumentType.COSTUME },
        },
        def: function ({ NAME }, { target }) {
          imageSourceSync = null;
          imageSource = new Promise((resolve, reject) => {
            if (!requireNonPackagedRuntime("texture from costume")) { resolve(null); return; }
            const costumeIndex = target.getCostumeIndexByName(NAME);
            if (costumeIndex == -1) return;
            const costume = target.sprite.costumes[costumeIndex];
            const img = new Image();
            img.src = costume.asset.encodeDataURI();
            img.onload = function () { resolve({ width: img.width, height: img.height, data: img }); };
            img.onerror = function () { resolve(null); };
          });
          return "[texture data]";
        },
      },
      {
        opcode: "textureFromText",
        blockType: BlockType.REPORTER,
        text: "利用文字 [TEXT] 生成贴图 (字体 [FONT] 颜色 [COLOR])",
        arguments: {
          TEXT: { type: ArgumentType.STRING, defaultValue: "Geek Teacher" },
          FONT: { type: ArgumentType.STRING, defaultValue: "italic bold 32px sans-serif" },
          COLOR: { type: ArgumentType.COLOR, defaultValue: "#ffff00" },
        },
        def: function ({ TEXT, FONT, COLOR }) {
          TEXT = Cast.toString(TEXT); FONT = Cast.toString(FONT); COLOR = Cast.toRgbColorObject(COLOR);
          imageSourceSync = null;
          imageSource = new Promise((resolve, reject) => {
            const canv = document.createElement("canvas");
            const ctx = canv.getContext("2d");
            ctx.font = FONT;
            const m = ctx.measureText(TEXT);
            canv.width = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
            canv.height = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
            ctx.clearRect(0, 0, canv.width, canv.height);
            ctx.font = FONT;
            ctx.fillStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${(COLOR.a ?? 255) / 255})`;
            ctx.fillText(TEXT, m.actualBoundingBoxLeft, m.fontBoundingBoxAscent);
            imageSourceSync = { width: canv.width, height: canv.height, data: canv };
            resolve(imageSourceSync);
          });
          return "[texture data]";
        },
      },
      {
        opcode: "textureFromTextWithBorder",
        blockType: BlockType.REPORTER,
        text: "利用文字 [TEXT] 生成描边贴图 (字体 [FONT] 颜色 [COLOR] 边框宽度 [BORDERSIZE] 颜色 [BORDERCOLOR])",
        arguments: {
          TEXT: { type: ArgumentType.STRING, defaultValue: "Hello World!" },
          FONT: { type: ArgumentType.STRING, defaultValue: "italic bold 32px sans-serif" },
          COLOR: { type: ArgumentType.COLOR, defaultValue: "#ffff00" },
          BORDERSIZE: { type: ArgumentType.NUMBER, defaultValue: 1 },
          BORDERCOLOR: { type: ArgumentType.COLOR, defaultValue: "#000000" },
        },
        def: function ({ TEXT, FONT, COLOR, BORDERSIZE, BORDERCOLOR }) {
          TEXT = Cast.toString(TEXT); FONT = Cast.toString(FONT); COLOR = Cast.toRgbColorObject(COLOR); BORDERSIZE = Cast.toNumber(BORDERSIZE); BORDERCOLOR = Cast.toRgbColorObject(BORDERCOLOR);
          const BORDERSIZECEIL = Math.ceil(BORDERSIZE);
          imageSourceSync = null;
          imageSource = new Promise((resolve, reject) => {
            const canv = document.createElement("canvas");
            const ctx = canv.getContext("2d");
            ctx.font = FONT; const m = ctx.measureText(TEXT);
            canv.width = m.actualBoundingBoxLeft + m.actualBoundingBoxRight + 2 * BORDERSIZECEIL;
            canv.height = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent + 2 * BORDERSIZECEIL;
            ctx.clearRect(0, 0, canv.width, canv.height);
            ctx.font = FONT; ctx.lineWidth = BORDERSIZE;
            ctx.fillStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${(COLOR.a ?? 255) / 255})`;
            ctx.strokeStyle = `rgba(${BORDERCOLOR.r},${BORDERCOLOR.g},${BORDERCOLOR.b},${(BORDERCOLOR.a ?? 255) / 255})`;
            ctx.fillText(TEXT, m.actualBoundingBoxLeft + BORDERSIZECEIL, m.fontBoundingBoxAscent + BORDERSIZECEIL);
            ctx.strokeText(TEXT, m.actualBoundingBoxLeft + BORDERSIZECEIL, m.fontBoundingBoxAscent + BORDERSIZECEIL);
            imageSourceSync = { width: canv.width, height: canv.height, data: canv };
            resolve(imageSourceSync);
          });
          return "[texture data]";
        },
      },
      {
        opcode: "textureFromList",
        blockType: BlockType.REPORTER,
        text: "利用列表 [NAME] 从索引 [POS] 生成尺寸为 [WIDTH]x[HEIGHT] 的贴图",
        arguments: {
          NAME: { type: ArgumentType.STRING, menu: "lists" },
          POS: { type: ArgumentType.NUMBER, defaultValue: 1 },
          WIDTH: { type: ArgumentType.NUMBER, defaultValue: 16 },
          HEIGHT: { type: ArgumentType.NUMBER, defaultValue: 16 },
        },
        def: function ({ NAME, POS, WIDTH, HEIGHT }, { target }) {
          let retStatus = "[texture data]";
          imageSourceSync = null;
          imageSource = new Promise((resolve, reject) => {
            const width = Cast.toNumber(WIDTH), height = Cast.toNumber(HEIGHT), listName = Cast.toString(NAME);
            const lengthRequired = width * height * 4;
            if (width < 1 || height < 1 || !Number.isFinite(width) || !Number.isFinite(height)) { retStatus = "invalid texture size"; resolve(null); return; }
            const list = target.lookupVariableByNameAndType(listName, "list");
            if (!list) { retStatus = "list not found"; resolve(null); return; }
            const pos = Cast.toNumber(POS) - 1;
            if (!Number.isFinite(pos) || pos < 0) { retStatus = "invalid position"; resolve(null); return; }
            if (list.value.length < pos + lengthRequired) { retStatus = "insufficient list length"; resolve(null); return; }
            const data = new Uint8Array(lengthRequired);
            const values = list.value;
            for (let i = 0; i < lengthRequired; i++) { data[i] = values[pos + i]; }
            imageSourceSync = { width: width, height: height, data: data };
            resolve(imageSourceSync);
          });
          return retStatus;
        },
      },
      {
        opcode: "textureFromSize",
        blockType: BlockType.REPORTER,
        text: "创建一个尺寸为 [WIDTH]x[HEIGHT] 的空贴图容器",
        arguments: {
          WIDTH: { type: ArgumentType.NUMBER, defaultValue: 16 },
          HEIGHT: { type: ArgumentType.NUMBER, defaultValue: 16 },
        },
        def: function ({ WIDTH, HEIGHT }, { target }) {
          let retStatus = "[texture data]";
          imageSourceSync = null;
          imageSource = new Promise((resolve, reject) => {
            const width = Cast.toNumber(WIDTH), height = Cast.toNumber(HEIGHT);
            if (width < 1 || height < 1 || !Number.isFinite(width) || !Number.isFinite(height)) { retStatus = "invalid texture size"; resolve(null); return; }
            imageSourceSync = { width: width, height: height, data: null }; resolve(imageSourceSync);
          });
          return retStatus;
        },
      },
      {
        blockType: BlockType.LABEL,
        text: "文本边界测量 (Text measurement)",
      },
      {
        opcode: "measureText",
        blockType: BlockType.COMMAND,
        text: "在后台测量文本 [TEXT] 在字体 [FONT] 下的物理尺寸",
        arguments: {
          PROP: { type: ArgumentType.STRING, defaultValue: "up" },
          TEXT: { type: ArgumentType.STRING, defaultValue: "Hello World!" },
          FONT: { type: ArgumentType.STRING, defaultValue: "italic bold 32px sans-serif" },
        },
        def: function ({ PROP, TEXT, FONT }) {
          TEXT = Cast.toString(TEXT); FONT = Cast.toString(FONT);
          const canv = document.createElement("canvas");
          const ctx = canv.getContext("2d"); ctx.font = FONT; lastTextMeasurement = ctx.measureText(TEXT);
        },
      },
      {
        opcode: "readMeasuredText",
        blockType: BlockType.REPORTER,
        text: "获取测量结果：文本的 [DIR] 尺寸",
        arguments: {
          DIR: { type: ArgumentType.STRING, menu: "directions", defaultValue: "up" },
        },
        def: function ({ DIR }) {
          if (!lastTextMeasurement) return 0;
          DIR = Cast.toString(DIR);
          if (DIR == "up") return lastTextMeasurement.fontBoundingBoxAscent;
          if (DIR == "down") return lastTextMeasurement.fontBoundingBoxDescent;
          if (DIR == "left") return lastTextMeasurement.actualBoundingBoxLeft;
          if (DIR == "right") return lastTextMeasurement.actualBoundingBoxRight;
          if (DIR == "x step") return lastTextMeasurement.width;
          return 0;
        },
      },
      {
        blockType: BlockType.LABEL,
        text: "字体快速配置 (Fonts)",
      },
      {
        opcode: "getFont",
        blockType: BlockType.REPORTER,
        text: "拼接 CSS 字体样式：字族 [FONT] 字号 [SIZE]",
        arguments: {
          FONT: { type: ArgumentType.STRING, menu: "fonts", defaultValue: "Sans Serif" },
          SIZE: { type: ArgumentType.NUMBER, defaultValue: 32 },
        },
        def: function ({ FONT, SIZE }) {
          FONT = Cast.toString(FONT); SIZE = Math.min(Math.max(Cast.toNumber(SIZE), 1), 1000);
          return `${SIZE}px ${FONT}`;
        },
      },
      {
        blockType: BlockType.LABEL,
        text: "底层数学变换与摄像机机位 (View transformations)",
      },
      {
        opcode: "matSelect",
        blockType: BlockType.COMMAND,
        text: "选中修改 [TRANSFORM] 变换矩阵",
        arguments: {
          TRANSFORM: { type: ArgumentType.STRING, menu: "renderTransforms" },
        },
        def: function ({ TRANSFORM }, { target }) {
          if (hasOwn(transforms, TRANSFORM)) selectedTransform = TRANSFORM;
        },
      },
      {
        opcode: "matStartWithPerspective",
        blockType: BlockType.COMMAND,
        text: "覆盖为“透视投影”摄像机 (视野夹角[FOV]度，渲染起点[NEAR]，终点[FAR])",
        arguments: {
          FOV: { type: ArgumentType.NUMBER, defaultValue: 90 },
          NEAR: { type: ArgumentType.NUMBER, defaultValue: 0.1 },
          FAR: { type: ArgumentType.NUMBER, defaultValue: 1000 },
        },
        def: function ({ FOV, NEAR, FAR }) {
          transforms[selectedTransform] = m4.perspective((Cast.toNumber(FOV) / 180) * Math.PI, currentRenderTarget.getAspectRatio(), Cast.toNumber(NEAR), Cast.toNumber(FAR));
        },
      },
      {
        opcode: "matStartWithOrthographic",
        blockType: BlockType.COMMAND,
        text: "覆盖为“正交投影”2.5D摄像机 (渲染起点[NEAR]，终点[FAR])",
        arguments: {
          NEAR: { type: ArgumentType.NUMBER, defaultValue: 0.1 },
          FAR: { type: ArgumentType.NUMBER, defaultValue: 1000 },
        },
        def: function ({ NEAR, FAR }) {
          transforms[selectedTransform] = m4.orthographic(currentRenderTarget.getAspectRatio(), Cast.toNumber(NEAR), Cast.toNumber(FAR));
        },
      },
      {
        opcode: "matStartWithIdentity",
        blockType: BlockType.COMMAND,
        text: "清空变换矩阵 (Identity / 归零)",
        def: function () { transforms[selectedTransform] = m4.identity(); },
      },
      {
        opcode: "matStartWithExternal",
        blockType: BlockType.COMMAND,
        text: "从外部插件 [SOURCE] 导入并覆盖矩阵数据",
        arguments: {
          SOURCE: { type: ArgumentType.STRING, menu: "externalTransforms" },
        },
        def: function ({ SOURCE }, util) {
          if (!hasOwn(externalTransforms, SOURCE)) return;
          const src = externalTransforms[SOURCE]; transforms[selectedTransform] = src.get() ?? m4.identity();
        },
      },
      {
        opcode: "matStartWithSavedIn",
        blockType: BlockType.COMMAND,
        text: "从列表 [SRCLIST] 的第 [POS] 项读取 16 位矩阵并覆盖",
        arguments: {
          SRCLIST: { type: ArgumentType.STRING, menu: "lists" },
          POS: { type: ArgumentType.NUMBER, defaultValue: 1 },
        },
        def: function ({ SRCLIST, POS }, { target }) {
          const pos = Math.floor(Cast.toNumber(POS));
          const list = target.lookupVariableByNameAndType(Cast.toString(SRCLIST), "list");
          if (!list) return;
          if (!Number.isFinite(pos) || pos < 1 || pos + 15 > list.value.length) return;
          transforms[selectedTransform] = list.value.slice(pos - 1, pos + 15).map(Cast.toNumber);
        },
      },
      {
        opcode: "matMove",
        blockType: BlockType.COMMAND,
        text: "在当前坐标系下移动 X: [X] Y: [Y] Z: [Z]",
        arguments: {
          X: { type: ArgumentType.NUMBER }, Y: { type: ArgumentType.NUMBER }, Z: { type: ArgumentType.NUMBER },
        },
        def: function ({ X, Y, Z }) {
          transforms[selectedTransform] = m4.translate(transforms[selectedTransform], Cast.toNumber(X), Cast.toNumber(Y), Cast.toNumber(Z));
        },
      },
      {
        opcode: "matRotate",
        blockType: BlockType.COMMAND,
        text: "绕自身 [AXIS] 轴旋转 [ANGLE] 度",
        arguments: {
          AXIS: { type: ArgumentType.STRING, menu: "axis" },
          ANGLE: { type: ArgumentType.ANGLE },
        },
        def: function ({ AXIS, ANGLE }) {
          let fn;
          if (AXIS == "X") fn = m4.xRotate; if (AXIS == "Y") fn = m4.yRotate; if (AXIS == "Z") fn = m4.zRotate;
          if (!fn) return;
          transforms[selectedTransform] = fn(transforms[selectedTransform], (Cast.toNumber(ANGLE) / 180) * Math.PI);
        },
      },
      {
        opcode: "matScale",
        blockType: BlockType.COMMAND,
        text: "按自身轴向缩放倍数 X: [X] Y: [Y] Z: [Z]",
        arguments: {
          X: { type: ArgumentType.NUMBER, defaultValue: 1 }, Y: { type: ArgumentType.NUMBER, defaultValue: 1 }, Z: { type: ArgumentType.NUMBER, defaultValue: 1 },
        },
        def: function ({ X, Y, Z }) {
          transforms[selectedTransform] = m4.scale(transforms[selectedTransform], Cast.toNumber(X), Cast.toNumber(Y), Cast.toNumber(Z));
        },
      },
      {
        opcode: "matWrapper",
        blockType: BlockType.CONDITIONAL,
        text: "使用隔离环境计算矩阵变换 (此内的缩放移动不影响外部)",
        def: function (_, util) {
          if (util.stackFrame.undoWrapper) {
            util.stackFrame.undoWrapper = false;
            transforms = util.stackFrame.mat3Dstack.pop();
          } else {
            util.stackFrame.undoWrapper = true;
            if (!util.stackFrame.mat3Dstack) util.stackFrame.mat3Dstack = [];
            util.stackFrame.mat3Dstack.push(Object.assign({}, transforms));
            util.startBranch(1, true);
          }
        },
      },
      {
        opcode: "matSaveInto",
        blockType: BlockType.COMMAND,
        text: "备份当前矩阵到列表 [DSTLIST] 的第 [POS] 项起点",
        arguments: {
          DSTLIST: { type: ArgumentType.STRING, menu: "lists" },
          POS: { type: ArgumentType.NUMBER, defaultValue: 1 },
        },
        def: function ({ DSTLIST, POS }, { target }) {
          const pos = Math.floor(Cast.toNumber(POS)) - 1;
          const list = target.lookupVariableByNameAndType(Cast.toString(DSTLIST), "list");
          if (!list) return;
          if (pos < 0 || !Number.isFinite(pos)) return;
          const value = list.value; const mat = transforms[selectedTransform];
          while (value.length < pos + 15) { value.push(0); }
          for (let i = 0; i < 16; i++) { value[pos + i] = mat[i]; }
          list._monitorUpToDate = false;
        },
      },
      {
        opcode: "matReset",
        blockType: BlockType.COMMAND,
        text: "清除当前矩阵的 [COMPONENT] 数据",
        arguments: {
          COMPONENT: { type: ArgumentType.STRING, menu: "matComponent" },
        },
        def: function ({ COMPONENT }) {
          const a = transforms[selectedTransform];
          if (COMPONENT == "rotation") { transforms[selectedTransform] = [ 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, a[12], a[13], a[14], 1, ]; }
          if (COMPONENT == "offset") { transforms[selectedTransform] = [ a[0], a[1], a[2], 0, a[4], a[5], a[6], 0, a[8], a[9], a[10], 0, 0, 0, 0, 1, ]; }
        },
      },
      {
        blockType: BlockType.LABEL,
        text: "自定义数学与屏幕映射换算",
      },
      {
        opcode: "matTransform",
        blockType: BlockType.COMMAND,
        text: "预计算该坐标的真实空间位置 X: [X] Y: [Y] Z: [Z]",
        arguments: {
          X: { type: ArgumentType.NUMBER }, Y: { type: ArgumentType.NUMBER }, Z: { type: ArgumentType.NUMBER },
        },
        def: function ({ X, Y, Z }) {
          const vec = [Cast.toNumber(X), Cast.toNumber(Y), Cast.toNumber(Z), 1];
          transformed = m4.multiplyVec(transforms[selectedTransform], vec);
        },
      },
      {
        opcode: "matTransformFromTo",
        blockType: BlockType.COMMAND,
        text: "跨空间数学换算：将坐标 X:[X] Y:[Y] Z:[Z] 从 [FROM] 空间推算到 [TO] 空间",
        arguments: {
          X: { type: ArgumentType.NUMBER }, Y: { type: ArgumentType.NUMBER }, Z: { type: ArgumentType.NUMBER },
          FROM: { type: ArgumentType.STRING, menu: "vectorTransformsMin2", defaultValue: "world space" },
          TO: { type: ArgumentType.STRING, menu: "vectorTransforms", defaultValue: "model space" },
        },
        def: function ({ X, Y, Z, FROM, TO }) {
          const lookup = { projected: 4, "projected (scratch units)": 4, "view space": 3, "world space": 2, "model space": 1 };
          const lookup2 = [ null, transforms.modelToWorld, transforms.worldToView, transforms.viewToProjected ];
          let from = lookup[FROM]; let to = lookup[TO];
          if (!from || !to) return;
          const vec = [Cast.toNumber(X), Cast.toNumber(Y), Cast.toNumber(Z), 1];
          if (from == to) { transformed = vec; return; }
          if (lookup2[from] === transformCache.from && lookup2[to] === transformCache.to) { transformed = m4.multiplyVec(transformCache.matrix, vec); return; }
          transformCache.from = lookup2[from]; transformCache.to = lookup2[to];
          let swapped = false;
          if (from > to) { [from, to] = [to, from]; swapped = true; }
          let totalMat = lookup2[from];
          for (let i = from + 1; i < to; i++) { totalMat = m4.multiply(lookup2[i], totalMat); }
          if (swapped) totalMat = m4.inverse(totalMat);
          transformCache.matrix = totalMat;
          transformed = m4.multiplyVec(totalMat, vec);
          if (TO == "projected (scratch units)") {
            transformed[0] = ((transformed[0] / transformed[3]) * runtime.stageWidth) / 2;
            transformed[1] = ((transformed[1] / transformed[3]) * runtime.stageHeight) / 2;
            transformed[2] = transformed[3];
          }
        },
      },
      {
        opcode: "matTransformFromToDir",
        blockType: BlockType.COMMAND,
        text: "跨空间数学换算：将方向向量 X:[X] Y:[Y] Z:[Z] 从 [FROM] 推算到 [TO]",
        arguments: {
          X: { type: ArgumentType.NUMBER }, Y: { type: ArgumentType.NUMBER }, Z: { type: ArgumentType.NUMBER },
          FROM: { type: ArgumentType.STRING, menu: "vectorTransformsMin2", defaultValue: "world space" },
          TO: { type: ArgumentType.STRING, menu: "vectorTransformsMin1", defaultValue: "model space" },
        },
        def: function ({ X, Y, Z, FROM, TO }) {
          const lookup = { projected: 4, "projected (scratch units)": 4, "view space": 3, "world space": 2, "model space": 1 };
          const lookup2 = [ null, transforms.modelToWorld, transforms.worldToView, transforms.viewToProjected ];
          let from = lookup[FROM]; let to = lookup[TO];
          if (!from || !to) return;
          const vec = [Cast.toNumber(X), Cast.toNumber(Y), Cast.toNumber(Z), 0];
          if (from == to) { transformed = vec; return; }
          if (lookup2[from] === transformCache.from && lookup2[to] === transformCache.to) { transformed = m4.multiplyVec(transformCache.matrix, vec); return; }
          transformCache.from = lookup2[from]; transformCache.to = lookup2[to];
          let swapped = false;
          if (from > to) { [from, to] = [to, from]; swapped = true; }
          let totalMat = lookup2[from];
          for (let i = from + 1; i < to; i++) { totalMat = m4.multiply(lookup2[i], totalMat); }
          if (swapped) totalMat = m4.inverse(totalMat);
          transformCache.matrix = totalMat;
          transformed = m4.multiplyVec(totalMat, vec);
        },
      },
      {
        opcode: "matTransformResult",
        blockType: BlockType.REPORTER,
        text: "获取刚刚数学换算出的结果：[AXIS] 轴分量",
        disableMonitor: true,
        arguments: {
          AXIS: { type: ArgumentType.STRING, menu: "axis" },
        },
        def: function ({ AXIS }) {
          const lookup = { X: 1, Y: 2, Z: 3 };
          const index = lookup[AXIS];
          return index ? transformed[index - 1] : "";
        },
      },
      {
        blockType: BlockType.LABEL,
        text: "将 3D 渲染为贴图 (画中画/离屏渲染)",
      },
      {
        opcode: "renderToStage",
        blockType: BlockType.COMMAND,
        text: "设置渲染目标：直接画到舞台上 (默认)",
        def: function () { canvasRenderTarget.setAsRenderTarget(); },
      },
      {
        opcode: "renderToTexture",
        blockType: BlockType.COMMAND,
        text: "离屏渲染：将渲染画面包裹并覆盖到模型 [NAME] 贴图上",
        arguments: {
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
        },
        def: function ({ NAME }) {
          const mesh = meshes.get(Cast.toString(NAME));
          if (!mesh) return;
          if (!mesh.data.texture) return;
          if (!(mesh.data.texture instanceof Texture2D)) return;
          mesh.data.texture.main.setAsRenderTarget();
        },
      },
      {
        opcode: "renderToCubeTexture",
        blockType: BlockType.COMMAND,
        text: "立方体贴图离屏渲染：将画面画到 [NAME] 贴图的 [SIDE] 面上",
        arguments: {
          SIDE: { type: ArgumentType.STRING, menu: "cubeSide" },
          NAME: { type: ArgumentType.STRING, defaultValue: "我的模型" },
        },
        def: function ({ SIDE, NAME }) {
          const mesh = meshes.get(Cast.toString(NAME));
          if (!mesh) return;
          if (!mesh.data.texture) return;
          if (!(mesh.data.texture instanceof TextureCube)) return;
          const lookup = { "X+": "xpos", "X-": "xneg", "Y+": "ypos", "Y-": "yneg", "Z+": "zpos", "Z-": "zneg" };
          if (!hasOwn(lookup, SIDE)) return;
          mesh.data.texture[lookup[SIDE]].setAsRenderTarget();
        },
      },
      {
        opcode: "readRenderTarget",
        blockType: BlockType.COMMAND,
        text: "颜色取样：将当前渲染像素输出到列表 [DSTLIST]",
        arguments: {
          DSTLIST: { type: ArgumentType.STRING, menu: "lists" },
        },
        def: function ({ DSTLIST }, { target }) {
          const list = target.lookupVariableByNameAndType(Cast.toString(DSTLIST), "list");
          if (!list) return;
          if (!currentRenderTarget.checkIfValid()) return;
          const { x, y, w, h } = currentRenderTarget.getReadarea();
          if (w == 0 || h == 0) return;
          const pixels = new Uint8ClampedArray(w * h * 4);
          gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          list.value = Array.from(pixels);
          list._monitorUpToDate = false;
        },
      },
      {
        opcode: "renderTargetInfo",
        blockType: BlockType.REPORTER,
        text: "获取当前渲染目标：[PROPERTY]",
        allowDropAnywhere: true,
        disableMonitor: true,
        arguments: {
          PROPERTY: { type: ArgumentType.STRING, menu: "renderTargetProperty", defaultValue: "width" },
        },
        def: function ({ PROPERTY }) {
          if (PROPERTY == "mesh name") return currentRenderTarget.getMesh()?.name ?? "";
          if (PROPERTY == "width") return currentRenderTarget.width;
          if (PROPERTY == "height") return currentRenderTarget.height;
          if (PROPERTY == "aspect ratio") return currentRenderTarget.getAspectRatio();
          if (PROPERTY == "depth test") return currentRenderTarget.depthTest;
          if (PROPERTY == "depth write") return currentRenderTarget.depthWrite;
          if (PROPERTY == "has depth storage") return currentRenderTarget.hasDepthBuffer;
          if (PROPERTY == "image as data URI") {
            if (!currentRenderTarget.checkIfValid()) return "";
            const { x, y, w, h } = currentRenderTarget.getReadarea();
            if (w == 0 || h == 0) return "";
            const pixels = new Uint8ClampedArray(w * h * 4);
            gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            for (let i = 0; i < pixels.length; i += 4) {
              const alpha = pixels[i + 3] / 255;
              pixels[i + 0] /= alpha;
              pixels[i + 1] /= alpha;
              pixels[i + 2] /= alpha;
            }
            const canv = document.createElement("canvas");
            canv.width = w; canv.height = h;
            const ctx = canv.getContext("2d");
            const imgData = new ImageData(pixels, w, h);
            ctx.putImageData(imgData, 0, 0);
            return canv.toDataURL();
          }
          if (PROPERTY == "is valid for being drawn to") return currentRenderTarget.checkIfValid();
          if (PROPERTY == "has viewport box") return currentRenderTarget.viewport !== null;
          if (PROPERTY == "has clipping box") return currentRenderTarget.scissors !== null;
          if (PROPERTY == "has readback box") return currentRenderTarget.readarea !== null;
          return "";
        },
      },
      {
        opcode: "setRenderTargetBox",
        blockType: BlockType.COMMAND,
        text: "设置高级边界 [BOXTYPE] 从 X:[X1] Y:[Y1] 到 X:[X2] Y:[Y2]",
        arguments: {
          BOXTYPE: { type: ArgumentType.STRING, menu: "boxType" },
          X1: { type: ArgumentType.NUMBER, defaultValue: 0 },
          Y1: { type: ArgumentType.NUMBER, defaultValue: 0 },
          X2: { type: ArgumentType.NUMBER, defaultValue: 100 },
          Y2: { type: ArgumentType.NUMBER, defaultValue: 100 },
        },
        def: function ({ BOXTYPE, X1, Y1, X2, Y2 }) {
          X1 = Cast.toNumber(X1); Y1 = Cast.toNumber(Y1); X2 = Cast.toNumber(X2); Y2 = Cast.toNumber(Y2);
          const x = Math.min(X1, X2); const y = Math.min(Y1, Y2); const w = Math.max(X1, X2) - x; const h = Math.max(Y1, Y2) - y;
          if (BOXTYPE == "viewport box") { currentRenderTarget.viewport = { x, y, w, h }; }
          if (BOXTYPE == "clipping box") { currentRenderTarget.scissors = { x, y, w, h }; currentRenderTarget.updateScissorsEnabled(); }
          if (BOXTYPE == "readback box") { currentRenderTarget.readarea = { x, y, w, h }; }
          currentRenderTarget.updateViewport();
        },
      },
      {
        opcode: "clearRenderTargetBox",
        blockType: BlockType.COMMAND,
        text: "清除已设置的边界模式 [BOXTYPE]",
        arguments: {
          BOXTYPE: { type: ArgumentType.STRING, menu: "boxType" },
        },
        def: function ({ BOXTYPE }) {
          if (BOXTYPE == "viewport box") { currentRenderTarget.viewport = null; }
          if (BOXTYPE == "clipping box") { currentRenderTarget.scissors = null; currentRenderTarget.updateScissorsEnabled(); }
          if (BOXTYPE == "readback box") { currentRenderTarget.readarea = null; }
          currentRenderTarget.updateViewport();
        },
      },
      {
        blockType: BlockType.LABEL,
        text: "着色叠加与大雾特效 (Shading & Fog)",
      },
      {
        opcode: "setGlobalColor",
        blockType: BlockType.COMMAND,
        text: "设置全局颜色着色法为 [OPERATION] 颜色叠加值 R: [RED] G: [GREEN] B: [BLUE] Alpha(不透明度): [ALPHA]",
        arguments: {
          OPERATION: { type: ArgumentType.STRING, menu: "globalColor" },
          RED: { type: ArgumentType.NUMBER, defaultValue: 1 },
          GREEN: { type: ArgumentType.NUMBER, defaultValue: 1 },
          BLUE: { type: ArgumentType.NUMBER, defaultValue: 1 },
          ALPHA: { type: ArgumentType.NUMBER, defaultValue: 1 },
        },
        def: function ({ OPERATION, RED, GREEN, BLUE, ALPHA }) {
          const color = [ Cast.toNumber(RED), Cast.toNumber(GREEN), Cast.toNumber(BLUE), Cast.toNumber(ALPHA) ];
          if (OPERATION == "multiplier") colorMultiplier = color;
          if (OPERATION == "adder") colorAdder = color;
        },
      },
      {
        opcode: "setGlobalLighting",
        blockType: BlockType.COMMAND,
        text: "☀️全局光影：状态[ENABLE] 光源方向 X:[X] Y:[Y] Z:[Z] 环境暗部亮度:[AMBIENT]",
        arguments: {
          ENABLE: { type: ArgumentType.STRING, menu: "onOff", defaultValue: "true" },
          X: { type: ArgumentType.NUMBER, defaultValue: 0.5 },
          Y: { type: ArgumentType.NUMBER, defaultValue: 1.0 },
          Z: { type: ArgumentType.NUMBER, defaultValue: 0.3 },
          AMBIENT: { type: ArgumentType.NUMBER, defaultValue: 0.4 }
        },
        def: function ({ ENABLE, X, Y, Z, AMBIENT }) {
           lightEnabled = Cast.toBoolean(ENABLE) ? 1.0 : 0.0;
           // 确保传入的向量是纯方向 (Normalize)
           let len = Math.sqrt(X*X + Y*Y + Z*Z) || 1;
           lightDir = [X/len, Y/len, Z/len];
           
           // 根据暗部亮度，自动平衡高光，防止画面过曝变成纯白
           let a = Math.max(0.0, Math.min(1.0, Cast.toNumber(AMBIENT)));
           ambientColor = [a, a, a];
           lightColor = [1.0 - (a * 0.5), 1.0 - (a * 0.5), 1.0 - (a * 0.5)];
        }
      },
      {
        opcode: "setFogEnabled",
        blockType: BlockType.COMMAND,
        text: "控制大雾(Fog)特效 [STATE]",
        arguments: {
          STATE: { type: ArgumentType.STRING, menu: "onOff" },
        },
        def: function ({ STATE }) {
          fogEnabled = Cast.toBoolean(STATE);
        },
      },
      {
        opcode: "setFogColor",
        blockType: BlockType.COMMAND,
        text: "设置雾效颜色 R: [RED] G: [GREEN] B: [BLUE]",
        arguments: {
          RED: { type: ArgumentType.NUMBER, defaultValue: 1 },
          GREEN: { type: ArgumentType.NUMBER, defaultValue: 1 },
          BLUE: { type: ArgumentType.NUMBER, defaultValue: 1 },
        },
        def: function ({ RED, GREEN, BLUE }) {
          fogColor = [ Cast.toNumber(RED), Cast.toNumber(GREEN), Cast.toNumber(BLUE) ];
        },
      },
      {
        opcode: "setFogDistance",
        blockType: BlockType.COMMAND,
        text: "设置雾浓度区间 (近处完全清晰距离: [NEAR] 远处完全模糊距离: [FAR])",
        arguments: {
          NEAR: { type: ArgumentType.NUMBER, defaultValue: 10 },
          FAR: { type: ArgumentType.NUMBER, defaultValue: 100 },
        },
        def: function ({ NEAR, FAR }) {
          NEAR = Cast.toNumber(NEAR); FAR = Cast.toNumber(FAR);
          fogDistance = [NEAR, FAR - NEAR];
        },
      },
      {
        opcode: "setFogPosition",
        blockType: BlockType.COMMAND,
        text: "设置大雾发源地基于 [SPACE] 坐标系 X: [X] Y: [Y] Z: [Z]",
        arguments: {
          SPACE: { type: ArgumentType.STRING, defaultValue: "view space", menu: "fogSpace" },
          X: { type: ArgumentType.NUMBER, defaultValue: 0 },
          Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
          Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
        },
        def: function ({ SPACE, X, Y, Z }) {
          fogSpace = Cast.toString(SPACE);
          fogPosition = [Cast.toNumber(X), Cast.toNumber(Y), Cast.toNumber(Z)];
          if (fogPosition[0] == 0 && fogPosition[1] == 0 && fogPosition[2] == 0) fogPosition = null;
        },
      },
      {
        blockType: BlockType.LABEL,
        text: "系统级事件 (Canvas)",
      },
      {
        opcode: "whenCanvasResized",
        blockType: BlockType.EVENT,
        text: "当舞台分辨率发生改变时",
        isEdgeActivated: false,
      },
      {
        opcode: "canvasWidth",
        blockType: BlockType.REPORTER,
        text: "真实渲染区宽度",
        def: function () { return canvas.width; },
      },
      {
        opcode: "canvasHeight",
        blockType: BlockType.REPORTER,
        text: "真实渲染区高度",
        def: function () { return canvas.height; },
      },
    ];
  
    class Extension {
      getInfo() {
        definitions.find((b) => b.opcode == "matStartWithExternal").hideFromPalette = Object.keys(externalTransforms).length == 0;
        return {
          id: extensionId,
          name: "Simple 3D (汉化Pro版)",
          color1: "#5CB1D6",
          color2: "#47A8D1",
          color3: "#2E8EB8",
          docsURI: "https://extensions.turbowarp.org/Xeltalliv/simple3D",
          blocks: definitions,
          menus: {
            fonts: { acceptReporters: false, items: "fontsMenu" },
            lists: { acceptReporters: false, items: "listsMenu" },
            // === 新增代码 4: 下拉菜单项 ===
            primitiveShapes: {
                acceptReporters: false,
                items: [
                { text: "标准立方体", value: "cube" },
                { text: "平滑球体", value: "sphere" }
                ]
            },
            costumes: { acceptReporters: true, items: "costumesMenu" },
            externalTransforms: { acceptReporters: true, items: "externalTransformsMenu" },
            // 深度汉化菜单 (文本对人类可见，内部依然发送原版纯英文供引擎识别)
            clearLayers: { acceptReporters: true, items: [{text: "颜色 (color)", value: "color"}, {text: "深度 (depth)", value: "depth"}, {text: "颜色和深度混合 (color and depth)", value: "color and depth"}] },
            primitives: { acceptReporters: true, items: [{text: "顶点 (points)", value: "points"}, {text: "独立线段 (lines)", value: "lines"}, {text: "循环线框 (line loop)", value: "line loop"}, {text: "连续线段 (line strip)", value: "line strip"}, {text: "独立三角形 (triangles)", value: "triangles"}, {text: "带状三角形 (triangle strip)", value: "triangle strip"}, {text: "扇形三角形 (triangle fan)", value: "triangle fan"}] },
            onOff: { acceptReporters: true, items: [{ text: "开启 (on)", value: "true" }, { text: "关闭 (off)", value: "false" }] },
            meshProperties: { acceptReporters: false, items: [{text: "是否存在该模型?", value: "exists"}, {text: "它的依赖继承来自", value: "inherits from"}, {text: "哪些模型继承了它", value: "is inherited by"}, {text: "是否通过了绘制合法检查?", value: "is valid for drawing"}, {text: "包含顶点索引(Vertex indices)吗?", value: "has vertex indices"}, {text: "包含坐标(Positions)吗?", value: "has positions"}, {text: "包含RGB颜色吗?", value: "has colors"}, {text: "包含纹理(Texture)贴图坐标吗?", value: "has texture coordinates"}, {text: "包含骨骼(Bone)坐标或权重吗?", value: "has bone indices/weights"}, {text: "包含独立骨架系统吗?", value: "has bones"}, {text: "包含GPU实例化坐标列表吗?", value: "has instanced positions"}, {text: "包含GPU实例化颜色列表吗?", value: "has instanced colors"}, {text: "包含GPU实例化贴图(UVs)吗?", value: "has instanced uvs"}, {text: "是否有贴图图层", value: "has texture"}, {text: "贴图图层真实宽度", value: "texture width"}, {text: "贴图图层真实高度", value: "texture height"}, {text: "贴图是否写入深度值", value: "texture depth write"}, {text: "预设几何渲染模式", value: "primitive type"}, {text: "混合叠加(Blending)模式", value: "blending type"}, {text: "背面剔除(Culling)模式", value: "culling type"}, {text: "是否开启恒定面向镜头(Billboard)?", value: "has billboarding"}] },
            axis: { acceptReporters: false, items: ["X", "Y", "Z"] },
            textureWrap: { acceptReporters: false, items: [{text: "强行铺满截取 (clamp to edge)", value: "clamp to edge"}, {text: "平铺重复循环 (repeat)", value: "repeat"}] },
            textureFilter: { acceptReporters: false, items: [{text: "像素化风格 (pixelated)", value: "pixelated"}, {text: "高斯模糊抗锯齿 (blurred)", value: "blurred"}] },
            textureMipmapping: { acceptReporters: false, items: [{text: "关闭渐远 (off)", value: "off"}, {text: "锐利级联过渡 (sharp transitions)", value: "sharp transitions"}, {text: "平滑融合过渡 (smooth transitions)", value: "smooth transitions"}] },
            cubeSide: { acceptReporters: true, items: ["X+", "X-", "Y+", "Y-", "Z+", "Z-"] },
            blending: { acceptReporters: true, items: [{text: "覆写颜色(最快) (overwrite color)", value: "overwrite color (fastest for opaque)"}, {text: "默认透明通道混合 (default)", value: "default"}, {text: "基于目标层透明度默认 (default behind)", value: "default behind"}, {text: "颜色加性发光混合 (additive)", value: "additive"}, {text: "色彩扣除黑洞 (subtractive)", value: "subtractive"}, {text: "正片叠底染色 (multiply)", value: "multiply"}, {text: "颜色反转赛博朋克 (invert)", value: "invert"}, {text: "完全隐形不渲染 (invisible)", value: "invisible"}, {text: "作为遮罩层渲染 (mask)", value: "mask"}, {text: "橡皮擦擦除图层 (erase)", value: "erase"}] },
            culling: { acceptReporters: true, items: [{text: "完全不剔除/渲染双面 (nothing)", value: "nothing"}, {text: "剔除看不见的背面 (back faces)", value: "back faces"}, {text: "反转剔除正面 (front faces)", value: "front faces"}] },
            skinningTransforms: { acceptReporters: true, items: [{text: "最初原始绑定 (original)", value: "original"}, {text: "当前姿态绑定 (current)", value: "current"}] },
            renderTransforms: { acceptReporters: false, items: [{ text: "模型坐标系 -> 真实世界坐标系 (to model -> world)", value: "modelToWorld" }, { text: "真实世界坐标系 -> 摄影机镜头系 (to world -> view)", value: "worldToView" }, { text: "摄影机镜头系 -> 屏幕透视系 (to view -> projected)", value: "viewToProjected" }, { text: "用于外部文件导入 (importing)", value: "import" }, { text: "给高级用户自定义 (custom)", value: "custom" }] },
            matComponent: { acceptReporters: true, items: [{text: "平移偏移 (offset)", value: "offset"}, {text: "角度旋转 (rotation)", value: "rotation"}] },
            vectorTransforms: { acceptReporters: false, items: [{text: "Scratch 单位制投影屏幕 (projected scratch units)", value: "projected (scratch units)"}, {text: "GL 极坐标系投影屏幕 (projected)", value: "projected"}, {text: "摄影机视口空间 (view space)", value: "view space"}, {text: "真实世界空间 (world space)", value: "world space"}, {text: "单一物体模型空间 (model space)", value: "model space"}] },
            vectorTransformsMin1: { acceptReporters: false, items: [{text: "GL 投影 (projected)", value: "projected"}, {text: "摄影机视口 (view space)", value: "view space"}, {text: "真实世界 (world space)", value: "world space"}, {text: "物体模型内部 (model space)", value: "model space"}] },
            vectorTransformsMin2: { acceptReporters: false, items: [{text: "摄影机视口 (view space)", value: "view space"}, {text: "真实世界 (world space)", value: "world space"}, {text: "物体模型内部 (model space)", value: "model space"}] },
            fogSpace: { acceptReporters: false, items: [{text: "跟随着摄影机 (view space)", value: "view space"}, {text: "固定在世界坐标 (world space)", value: "world space"}, {text: "跟着某个模型内部 (model space)", value: "model space"}] },
            renderTargetProperty: { acceptReporters: false, items: [{text:"绑定的模型名称", value:"mesh name"}, {text:"渲染宽度", value:"width"}, {text:"渲染高度", value:"height"}, {text:"渲染长宽比", value:"aspect ratio"}, {text:"深度测试算法", value:"depth test"}, {text:"是否允许写入深度", value:"depth write"}, {text:"包含深度缓冲区吗", value:"has depth storage"}, {text:"导出渲染为本地数据 URI 链接", value:"image as data URI"}, {text:"它作为绘制目标合法吗", value:"is valid for being drawn to"}] },
            filetype: { acceptReporters: false, items: ["obj mtl", "off"] },
            globalColor: { acceptReporters: false, items: [{text: "色彩乘法 (multiplier)", value: "multiplier"}, {text: "光照加法叠加 (adder)", value: "adder"}] },
            alphaTestMode: { acceptReporters: false, items: [{ text: "保留剩余物体的透明度", value: "false" }, { text: "强制剩余部分不透明 (性能最高)", value: "true" }] },
            instanceProperty: { acceptReporters: false, items: [{text:"完整4x4矩阵变换", value:"transforms"}, {text:"XY 纯 2D 位置", value:"XY positions"}, {text:"XYZ 纯位置分布", value:"XYZ positions"}, {text:"XYZ 位置 + 体积缩放调整", value:"XYZ positions and sizes"}, {text:"RGB 颜色", value:"RGB colors"}, {text:"RGBA 带透明颜色", value:"RGBA colors"}, {text:"贴图 UV 的裁剪偏移", value:"UV offsets"}, {text:"UV 的裁剪及大小配置", value:"UV offsets and sizes"}] },
            interleavedProperty: { acceptReporters: false, items: [{text:"XY 顶点坐标列表", value:"XY positions"}, {text:"XYZ 顶点坐标列表", value:"XYZ positions"}, {text:"RGB 顶点颜色", value:"RGB colors"}, {text:"RGBA 顶点带透明颜色", value:"RGBA colors"}, {text:"UV 标准贴图坐标", value:"UV texture coordinates"}, {text:"UVW 三维体贴图坐标", value:"UVW texture coordinates"}] },
            powersOfTwo: { acceptReporters: true, items: ["1", "2", "4", "8", "16"] },
            depthTest: { acceptReporters: true, items: [{text:"什么也不干 (never)", value:"nothing"}, {text:"只绘制离镜头更近的 (less/默认推荐)", value:"closer"}, {text:"只绘制完全重合的 (equal)", value:"same"}, {text:"只绘制更远的 (greater)", value:"further"}, {text:"绘制更近或相同的 (lequal)", value:"closer or same"}, {text:"绘制更远或相同的 (gequal)", value:"further or same"}, {text:"绘制不重合的 (notequal)", value:"not same"}, {text:"无视遮挡绘制所有 (always)", value:"everything"}] },
            directions: { acceptReporters: true, items: [{text:"朝上", value:"up"}, {text:"朝下", value:"down"}, {text:"朝左", value:"left"}, {text:"朝右", value:"right"}, {text:"横向整体步长(x step)", value:"x step"}] },
            bufferUsage: { acceptReporters: true, items: [{text:"地形/建筑等极少更新 (STATIC_DRAW)", value:"rarely"}, {text:"完全且高频的物理更新 (STREAM_DRAW)", value:"frequently fully"}, {text:"局部且高频的数组更新 (DYNAMIC_DRAW)", value:"frequently partially"}] },
            multiSampleInterpolation: { acceptReporters: true, items: [{text:"在像素中心采样一次 (最高性能)", value:"once at pixel center"}, {text:"在覆盖样本中点采样一次 (MSAA_CENTROID/推荐)", value:"once at midpoint of covered samples"}, {text:"为每个样本分别独立采样 (MSAA_SAMPLE/最耗性能)", value:"separately for each sample"}] },
            boxType: { acceptReporters: false, items: [{text:"镜头视口映射区 (viewport box)", value:"viewport box"}, {text:"画面强制裁剪区 (clipping box)", value:"clipping box"}, {text:"屏幕像素反向回读区 (readback box)", value:"readback box"}] },
            mappingShape: { 
              acceptReporters: false, 
              items: [
                  {text: "立体星球 (Planet)", value: "sphere"}, 
                  {text: "平铺地貌沙盘 (Plane)", value: "plane"}
              ] 
          },
          axisXY: { acceptReporters: false, items: ["X", "Y"] },
          voxelRayProp: { acceptReporters: false, items: ["命中方块X", "命中方块Y", "命中方块Z", "相邻空位X", "相邻空位Y", "相邻空位Z"] }
        }
        };
      }
      dispose() {
        resetEverything();
        removeSimple3DLayer();
        modelDecoder.destroy();
        runtime.removeListener("PROJECT_LOADED", resetEverything);
        canvas = null; gl = null;
        const noop = () => {};
        for (let block of definitions) {
          if (block == "---") continue;
          Extension.prototype[block.opcode ?? block.func] = noop;
        }
      }
      fontsMenu() {
        const defaultFonts = ["Sans Serif", "Serif", "Handwriting", "Marker", "Curly", "Pixel", "Scratch"];
        const customFonts = runtime.fontManager ? runtime.fontManager.getFonts().map((i) => ({ text: i.name, value: i.family })) : [];
        return [...defaultFonts, ...customFonts];
      }
      listsMenu() {
        const stage = vm.runtime.getTargetForStage();
        const editingTarget = vm.editingTarget !== stage ? vm.editingTarget : null;
        const local = editingTarget ? Object.values(editingTarget.variables).filter((v) => v.type == "list").map((v) => v.name) : [];
        const global = stage ? Object.values(stage.variables).filter((v) => v.type == "list").map((v) => v.name) : [];
        const all = [...local, ...global]; all.sort();
        if (all.length == 0) return ["list"]; return all;
      }
      costumesMenu() {
        let editingTarget = vm.editingTarget;
        if (editingTarget) return editingTarget.getCostumes().map((e) => e.name);
        return ["costume 1"];
      }
      externalTransformsMenu() {
        const out = [];
        for (let key in externalTransforms) { out.push({ value: key, text: externalTransforms[key].name }); }
        if (out.length == 0) out.push({ value: "", text: "- no external sources -" });
        return out;
      }
    }
  
    for (let block of definitions) {
      if (block == "---") continue;
      Extension.prototype[block.opcode ?? block.func] = block.def;
    }
  
    publicApi.i_will_not_ask_for_help_when_these_break = () => {
      return {
        canvas, gl, definitions, meshes, programs, modelDecoder, uploadBuffer,
        getFshSrc: () => fshSrc, setFshSrc: (src) => { fshSrc = src; },
        getVshSrc: () => vshSrc, setVshSrc: (src) => { vshSrc = src; },
        canvasRenderTarget, resetEverything,
        getTransforms: () => transforms, setTransforms: (t) => { transforms = t; },
        getSelectedTransform: () => selectedTransform, setSelectedTransform: (t) => { selectedTransform = t; },
        getWorkerSrc: () => workerSrc, setWorkerSrc: (src) => { workerSrc = src; },
        Blendings,
      };
    };
  
    Scratch.extensions.register(new Extension());
  })(Scratch);  