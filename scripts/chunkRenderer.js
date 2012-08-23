var ChunkRenderer = function(width, height) {
	this.buffer = new Buffer(width * height);
	this.x = 0;
	this.y = 0;
	this.width = width;
	this.height = height;
	this.skipEOL = false;

	this.copy = function(pixelsCount, data) {
		pixelsCount = this.fixPixelsCount(pixelsCount);
		if (pixelsCount <= 0)
			return;
		for (var i = 0; i < pixelsCount; i++) {
			this.buffer.setInt8(data.getInt8());
		}
		this.incrementPosition(pixelsCount);
	};
	this.fill = function(pixelsCount, value) {
		pixelsCount = this.fixPixelsCount(pixelsCount);
		if (pixelsCount <= 0)
			return;
		for (var i = 0; i < pixelsCount; i++) {
			this.buffer.setInt8(value);
		}
		this.incrementPosition(pixelsCount);
	};
	this.fillToEOL = function(value) {
		if (this.x !== 0 || !this.skipEOL) {
			this.fill(this.width - this.x, value);
		}
		this.skipEOL = false;
	};
	this.finish = function(value) {
		this.fill(this.buffer.length - this.buffer.byteOffset, value);
	};
	// prevent overflow
	this.fixPixelsCount = function(pixelsCount) {
		if (this.buffer.byteOffset + pixelsCount > this.buffer.length) {
			pixelsCount = this.buffer.length - this.buffer.byteOffset;
		}
		return pixelsCount;
	};
	this.incrementPosition = function(pixelsCount) {
		this.x += pixelsCount;
		this.y += this.x / this.width;
		this.x = this.x % this.width;
		this.skipEOL = true;
	};
	this.decode = function(mainOffset, mainBuffer, transparent) {
		// first byte
		// > 0 transparent pixels count
		// = 0 EOL
		// < 0 non transparent pixels count
		var b, amount;
		mainBuffer.byteOffset = mainOffset;
		while (this.buffer.byteOffset < this.buffer.length) {
			b = mainBuffer.getInt8();
			if (b === 0) {
				this.fillToEOL(transparent);
			} else if (b < 0x80) {
				amount = b;
				if (mainBuffer.length - mainOffset < amount) {
					amount = mainBuffer.length - mainOffset;
				}
				this.copy(amount, mainBuffer);
			} else {
				this.fill(0x100 - b, transparent);
			}
		}
		this.finish(transparent);
	};
};