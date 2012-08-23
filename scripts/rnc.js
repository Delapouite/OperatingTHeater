(function (root, factory) {
	if (typeof exports === 'object') {
		// Node
		module.exports = factory();
	} else if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module
		define(factory);
	} else {
		// Browser globals
		root.RNC = factory();
	}
}(this, function () {
	// utils

	// return the big-endian longword (4 bytes) at p.
	var blong = function(p) {
		var n = p[0];
		n = (n << 8) + p[1];
		n = (n << 8) + p[2];
		n = (n << 8) + p[3];
		return n;
	};

	// return the little-endian longword (4 bytes) at p.
	var llong = function(p) {
		var n = p[3];
		n = (n << 8) + p[2];
		n = (n << 8) + p[1];
		n = (n << 8) + p[0];
		return n;
	};

	// return the big-endian word (2 bytes) at p.
	var bword = function(p) {
		var n = p[0];
		n = (n << 8) + p[1];
		return n;
	};

	// return the little-endian word (2 bytes) at p.
	var lword = function (p) {
		var n = p[1];
		n = (n << 8) + p[0];
		return n;
	};

	// mirror the bottom n bits of x.
	var mirror = function(x, n) {
		var top = 1 << (n - 1),
			bottom = 1,
			mask,
			masked;
		while (top > bottom) {
			mask = top | bottom;
			masked = x & mask;
			if (masked !== 0 && masked != mask) {
				x ^= mask;
			}
			top >>= 1;
			bottom <<= 1;
		}
		return x;
	};

	var HuffmanTable = function(reader) {
		// first 5 bits, nodesCount in the tree
		var num = reader.read(0x1F, 5),
			i, j,
			leafMax = 1,
			leafLength = [],
			// big endian form of code
			bigEndianCode = 0;
		this.reader = reader;
		if (num === 0)
			return;
		// nodes
		this.table = [];
		// get leafMax
		for (i = 0; i < num; i++) {
			// 4 bites per node
			leafLength[i] = reader.read(0x0F, 4);
			if (leafMax < leafLength[i]) {
				leafMax = leafLength[i];
			}
		}
		// build table
		for (i = 1; i <= leafMax; i++) {
			for (j = 0; j < num; j++) {
				if (leafLength[j] == i) {
					this.table.push({
						code: mirror(bigEndianCode, i),
						length: i,
						value: j
					});
					bigEndianCode++;
				}
			}
			bigEndianCode <<= 1;
		}
		// reajust nodesCount in case of zeros
		this.nodesCount = this.table.length;
	};

	// read a value out of the bit stream using this given Huffman table
	HuffmanTable.prototype.read	= function() {
		var i, val, mask;

		for (i = 0; i < this.nodesCount; i++) {
			mask = (1 << this.table[i].length) - 1;
			if (this.reader.peek(mask) == this.table[i].code) {
				break;
			}
		}
		if (i == this.nodesCount)
			throw 'Huffman decode error';

		this.reader.advance(this.table[i].length);
		val = this.table[i].value;

		if (val >= 2) {
			val = 1 << (val - 1);
			val |= this.reader.read(val - 1, this.table[i].value - 1);
		}
		return val;
	};

	// initialize with the first two bytes of the compressed data
	BufferReader = function(input) {
		this.input = input;
		this.buffer = lword(this.input);
		// bits count
		this.count = 16;
	};

	// fix up a buffer after literals have been read out of the data stream
	BufferReader.prototype.fix = function() {
		this.count -= 16;
		// remove the top 16 bits
		this.buffer &= (1 << this.count) - 1;
		// replace with what's in input
		this.buffer |= (lword(this.input) << this.count);
		this.count += 16;
	};

	// return some bits
	BufferReader.prototype.peek = function(mask) {
		// i & 0x1F == i % 32
		return this.buffer & mask;
	};

	// advance the buffer
	BufferReader.prototype.advance = function(n) {
		this.buffer >>= n;
		this.count -= n;
		if (this.count < 16) {
			this.input = this.input.subarray(2);
			this.buffer |= (lword(this.input) << this.count);
			this.count += 16;
		}
	};

	//read some bits in one go (ie the above two methods combined)
	BufferReader.prototype.read = function(mask, n) {
		var result = this.peek(mask);
		this.advance(n);
		return result;
	};

	return {
		// "RNC\001"
		SIGNATURE: 0x524E4301,
		// prepopulated
		CRC_TABLE: [
			0x0000, 0xC0C1, 0xC181, 0x0140, 0xC301, 0x03C0, 0x0280, 0xC241,
			0xC601, 0x06C0, 0x0780, 0xC741, 0x0500, 0xC5C1, 0xC481, 0x0440,
			0xCC01, 0x0CC0, 0x0D80, 0xCD41, 0x0F00, 0xCFC1, 0xCE81, 0x0E40,
			0x0A00, 0xCAC1, 0xCB81, 0x0B40, 0xC901, 0x09C0, 0x0880, 0xC841,
			0xD801, 0x18C0, 0x1980, 0xD941, 0x1B00, 0xDBC1, 0xDA81, 0x1A40,
			0x1E00, 0xDEC1, 0xDF81, 0x1F40, 0xDD01, 0x1DC0, 0x1C80, 0xDC41,
			0x1400, 0xD4C1, 0xD581, 0x1540, 0xD701, 0x17C0, 0x1680, 0xD641,
			0xD201, 0x12C0, 0x1380, 0xD341, 0x1100, 0xD1C1, 0xD081, 0x1040,
			0xF001, 0x30C0, 0x3180, 0xF141, 0x3300, 0xF3C1, 0xF281, 0x3240,
			0x3600, 0xF6C1, 0xF781, 0x3740, 0xF501, 0x35C0, 0x3480, 0xF441,
			0x3C00, 0xFCC1, 0xFD81, 0x3D40, 0xFF01, 0x3FC0, 0x3E80, 0xFE41,
			0xFA01, 0x3AC0, 0x3B80, 0xFB41, 0x3900, 0xF9C1, 0xF881, 0x3840,
			0x2800, 0xE8C1, 0xE981, 0x2940, 0xEB01, 0x2BC0, 0x2A80, 0xEA41,
			0xEE01, 0x2EC0, 0x2F80, 0xEF41, 0x2D00, 0xEDC1, 0xEC81, 0x2C40,
			0xE401, 0x24C0, 0x2580, 0xE541, 0x2700, 0xE7C1, 0xE681, 0x2640,
			0x2200, 0xE2C1, 0xE381, 0x2340, 0xE101, 0x21C0, 0x2080, 0xE041,
			0xA001, 0x60C0, 0x6180, 0xA141, 0x6300, 0xA3C1, 0xA281, 0x6240,
			0x6600, 0xA6C1, 0xA781, 0x6740, 0xA501, 0x65C0, 0x6480, 0xA441,
			0x6C00, 0xACC1, 0xAD81, 0x6D40, 0xAF01, 0x6FC0, 0x6E80, 0xAE41,
			0xAA01, 0x6AC0, 0x6B80, 0xAB41, 0x6900, 0xA9C1, 0xA881, 0x6840,
			0x7800, 0xB8C1, 0xB981, 0x7940, 0xBB01, 0x7BC0, 0x7A80, 0xBA41,
			0xBE01, 0x7EC0, 0x7F80, 0xBF41, 0x7D00, 0xBDC1, 0xBC81, 0x7C40,
			0xB401, 0x74C0, 0x7580, 0xB541, 0x7700, 0xB7C1, 0xB681, 0x7640,
			0x7200, 0xB2C1, 0xB381, 0x7340, 0xB101, 0x71C0, 0x7080, 0xB041,
			0x5000, 0x90C1, 0x9181, 0x5140, 0x9301, 0x53C0, 0x5280, 0x9241,
			0x9601, 0x56C0, 0x5780, 0x9741, 0x5500, 0x95C1, 0x9481, 0x5440,
			0x9C01, 0x5CC0, 0x5D80, 0x9D41, 0x5F00, 0x9FC1, 0x9E81, 0x5E40,
			0x5A00, 0x9AC1, 0x9B81, 0x5B40, 0x9901, 0x59C0, 0x5880, 0x9841,
			0x8801, 0x48C0, 0x4980, 0x8941, 0x4B00, 0x8BC1, 0x8A81, 0x4A40,
			0x4E00, 0x8EC1, 0x8F81, 0x4F40, 0x8D01, 0x4DC0, 0x4C80, 0x8C41,
			0x4400, 0x84C1, 0x8581, 0x4540, 0x8701, 0x47C0, 0x4680, 0x8641,
			0x8201, 0x42C0, 0x4380, 0x8341, 0x4100, 0x81C1, 0x8081, 0x4040
		],
		// Offset 0, length 18
		headers: {
			// Should be equal to 'RNC'
			signature: [0, 3],
			// 1 or 2 in binary
			method: [3, 4],
			// signature + method
			fullSignature: [0, 4],
			// Length (in bytes) of the decompressed data
			originalLength: [4, 8],
			// Length (in bytes) of the bit-stream / byte-stream which makes up the remainder of the file
			compressedLength: [8, 12],
			// Checksum of the decompressed data
			originalCRC: [12, 14],
			// Checksum of the bit-stream / byte-stream which makes up the remainder of the file.
			compressedCRC: [14, 16],
			// Difference between compressed and uncompressed data in largest pack chunk (if larger than decompressed data)
			leeway: [16, 17],
			// Amount of packs
			packsCount: [17, 18]
		},
		// return a portion of the header
		getHeader: function(headerName, raw) {
			var header = this.headers[headerName],
				subarray;
			if (!header)
				throw 'Invalid header request';

			subarray = this.input.subarray(header[0], header[1]);
			if (raw)
				return subarray;
			// Each multi-byte portion of the header is big endian
			switch (header[1] - header[0]) {
				case 4:
					return blong(subarray);
				case 2:
					return bword(subarray);
				default:
					return subarray[0];
			}
		},
		// the first 3 bytes have to be "RNC" and the 1st compression method should be used
		isValid: function() {
			return this.getHeader('fullSignature') == this.SIGNATURE;
		},
		// use the prepopulated CRC_TABLE
		calculateCRC: function(data, length) {
			var val = i = 0;
			while (length--){
				val ^= data[i++];
				val = (val >> 8) ^ this.CRC_TABLE[val & 0xFF];
			}
			return val;
		},
		calculateCompressedCRC: function() {
			return this.calculateCRC(this.input.subarray(18), this.getHeader('compressedLength'));
		},
		calculateOriginalCRC: function(output) {
			return this.calculateCRC(output, this.getHeader('originalLength'));
		},
		unpack: function(input) {
			var output,
				outputIndex = 0,
				rawTable, distanceTable, lengthTable,
				packsCount,
				chunksCount,
				reader,
				// return by the rawTable
				literalsCount,
				// return by the distanceTable
				distance,
				// return by the lengthTable
				length;

			this.input = input;

			// check format
			if (!this.isValid())
				throw 'Not a RNC compressed file';

			// check integrity
			if (this.calculateCompressedCRC() != this.getHeader('compressedCRC'))
				throw 'Compressed CRC error';

			// initialized final ouput
			output = new Uint8Array(this.getHeader('originalLength'));
			packsCount = this.getHeader('packsCount');
			// skip 18 bits of header + 2 bits to start on entire compressed bits
			reader = new BufferReader(input.subarray(18));
			reader.advance(2);

			// process packs
			while (packsCount--) {
				// each pack has 3 Huffman tables
				rawTable = new HuffmanTable(reader);
				distanceTable = new HuffmanTable(reader);
				lengthTable = new HuffmanTable(reader);
				chunksCount = reader.read(0xFFFF, 16);
				// process chunks in this pack
				while (true) {
					// Huffman code value from the first tree in the bit stream for the amount of literals in the byte stream
					literalsCount = rawTable.read();
					if (literalsCount) {
						// add Literals from the byte stream
						while(literalsCount--) {
							// copy the current buffer content into the output
							output[outputIndex] = reader.input[0];
							// next
							outputIndex++;
							reader.input = reader.input.subarray(1);
						}
						reader.fix();
					}
					if (--chunksCount <= 0)
						break;

					// Huffman code from the bit stream that represents the distance - 1 of a distance/length pair
					distance = distanceTable.read() + 1;
					// Huffman code from the bit stream that represents the length - 2 of a distance/length pair
					length = lengthTable.read() + 2;
					while (length--) {
						output[outputIndex] = output[outputIndex - distance];
						outputIndex++;
					}
				}
			}
			if (this.calculateOriginalCRC(output) != this.getHeader('originalCRC'))
				throw 'Original CRC error';

			return output;
		}
	};
}));