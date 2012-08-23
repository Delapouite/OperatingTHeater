document.addEventListener('DOMContentLoaded', function() {
		// HTML elements
	var spritesDiv = document.getElementById('sprites'),
		palette = document.getElementById('palette'),
		// canvas contexts
		paletteContext = palette.getContext('2d'),
		// the original palette contained in the file is 16x16
		// too small for the user so the canvas is set to 256x256 (zoomed 16 times)
		zoom = palette.width / 16,
		paletteImageData = paletteContext.getImageData(0, 0, palette.width, palette.height),
		paletteUpscales = [
			0x00, 0x04, 0x08, 0x0C, 0x10, 0x14, 0x18, 0x1C,
			0x20, 0x24, 0x28, 0x2D, 0x31, 0x35, 0x39, 0x3D,
			0x41, 0x45, 0x49, 0x4D, 0x51, 0x55, 0x59, 0x5D,
			0x61, 0x65, 0x69, 0x6D, 0x71, 0x75, 0x79, 0x7D,
			0x82, 0x86, 0x8A, 0x8E, 0x92, 0x96, 0x9A, 0x9E,
			0xA2, 0xA6, 0xAA, 0xAE, 0xB2, 0xB6, 0xBA, 0xBE,
			0xC2, 0xC6, 0xCA, 0xCE, 0xD2, 0xD7, 0xDB, 0xDF,
			0xE3, 0xE7, 0xEB, 0xEF, 0xF3, 0xF7, 0xFB, 0xFF
		],
		// file input elements
		tableInput = document.getElementById('tableInput'),
		dataInput = document.getElementById('dataInput'),
		paletteInput = document.getElementById('paletteInput'),
		// file reader handling
		handleBuffer = function(fileBuffer, type) {
			var buffer = new Uint8Array(fileBuffer);
			// decompress if necessary
			try {
				buffer = RNC.unpack(buffer);
			} catch(e) {
				console.log('RNC ', e);
			}
			switch (type) {
				// palettes are 768 bytes so 256 pixels of rgb colors
				// 1 byte per color component
				case 'palette':
					// an alpha byte per pixel need to be added to be compatible with the canvas API
					// from rgbrgbrgbrgb... to rgbargbargba...
					var insertAlphaBytes = function(buffer) {
						var i = j = 0,
							alphaBuffer = new Uint8Array(1024);
						while (i < 768) {
							// color have to be upscaled with the corresponding table
							alphaBuffer[j++] = paletteUpscales[buffer[i++] & 0x3F]; // red
							alphaBuffer[j++] = paletteUpscales[buffer[i++] & 0x3F]; // green
							alphaBuffer[j++] = paletteUpscales[buffer[i++] & 0x3F]; // blue
							alphaBuffer[j++] = 0xFF; // alpha
						}
						return alphaBuffer;
					};
					var zoomBuffer = function(buffer, zoom) {
						var i = j = 0,
							zoomedBufferLength = buffer.length * zoom * zoom,
							zoomedBuffer = new Uint8Array(zoomedBufferLength);
						while (i < zoomedBufferLength) {
							zoomedBuffer[i++] = buffer[j];
							zoomedBuffer[i++] = buffer[j + 1];
							zoomedBuffer[i++] = buffer[j + 2];
							zoomedBuffer[i++] = buffer[j + 3];
							if ((i / 4) % zoom === 0) {
								// next x
								j += 4;
								// end of line
								if ((i / 4) % (16 * zoom) === 0) {
									// reset x
									if ((i / 4) % (16 * zoom * zoom) !== 0) {
										j -= 64;
									}
								}
							}
						}
						return zoomedBuffer;
					};
					// deal with missing alpha
					paletteColors = insertAlphaBytes(buffer);
					console.log(paletteColors);
					// zoom this buffer for visibility
					buffer = zoomBuffer(paletteColors, zoom);
					paletteImageData.data.set(buffer);
					paletteContext.putImageData(paletteImageData, 0, 0);
					break;
				// table files contain sprite dimensions
				// offset 32 bits, width 1 byte, height 1 byte
				case 'table':
					spritesTable = [];
					buffer = new Buffer(buffer);
					while (buffer.byteOffset < buffer.length - 1) {
						spritesTable.push({
							offset: buffer.getUint32(true),
							width: buffer.getUint8(),
							height: buffer.getUint8()
						});
					}
					break;
				// the content of the corresponding table file is needed to extract the chunks
				case 'data':
					if (!spritesTable.length)
						return;
					var color, spriteBitmaps = [];
					buffer = new Buffer(buffer);
					paletteColors = new Buffer(paletteColors);
					spritesTable.forEach(function(sprite) {
						if (sprite.width === 0)
							return;
						renderer = new ChunkRenderer(sprite.width, sprite.height);
						renderer.decode(sprite.offset, buffer, 0xFF);
						pixels = new Buffer(renderer.buffer.length * 4);
						renderer.buffer.byteOffset = 0;
						while (renderer.buffer.byteOffset < renderer.buffer.length - 1) {
							paletteColors.byteOffset = renderer.buffer.getUint8();
							pixels.setUint8(paletteColors.getUint8()); // r
							pixels.setUint8(paletteColors.getUint8()); // g
							pixels.setUint8(paletteColors.getUint8()); // b
							pixels.setUint8(paletteColors.getUint8()); // a
						}
						console.log(pixels.toArrayBuffer(), pixels.length, sprite.width, sprite.height);
						spritesDiv.appendChild(createCanvas(sprite.width, sprite.height, pixels.toArrayBuffer()));
					});
					break;
			}
		},
		loadFile = function(evt) {
			var self = this,
				reader = new FileReader();
			reader.addEventListener('loadend', function(evt) {
				handleBuffer(evt.target.result, self.id.slice(0, -5));
			});
			reader.readAsArrayBuffer(evt.target.files[0]);
		},
		createCanvas = function(width, height, data) {
			var canvas = document.createElement('canvas'),
				context = canvas.getContext('2d'),
				imageData = context.getImageData(0, 0, width, height);
			canvas.width = width;
			canvas.height = height;
			imageData.data.set(data);
			context.putImageData(imageData, 0, 0);
			return canvas;
		};

	// file inputs listeners
	tableInput.addEventListener('change', loadFile, false);
	dataInput.addEventListener('change', loadFile, false);
	paletteInput.addEventListener('change', loadFile, false);
});