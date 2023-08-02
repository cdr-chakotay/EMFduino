const { SerialPort } = require('serialport');

/**
 * Takes a time stamp as an integer and returns a human readable date string.
 * @param {Number} timeStampInt
 * @returns YYYY-MM-DD-HH:mm:ss
 */
function formatDateHumanReadable(timeStampInt) {
    // Format Date for human readable output at the console
    const timeMillis = timeStampInt * 1000;
    const date = new Date(timeMillis);
    const timeString = date
        .toLocaleTimeString('de-DE', {
            timeZone: 'Europe/Berlin',
        })
        .replaceAll(':', '-');
    const dateString = date.toLocaleDateString('fr-CA', {
        timeZone: 'Europe/Berlin',
    });
    const formattedDate = `${dateString}_${timeString}`;
    return formattedDate;
}

/**
 * @class SerialPortReader reads data from a serial port and calls a callback function with the values
 */
class SerialPortReader {
    /**
     * @constructor
     * @param portPath - Path to the serial port
     * @param dataCallback - Callback function that is called with the values from the serial port
     * @param minTolerance - Minimum frequency tolerance in Hz
     * @param maxTolerance - Maximum frequency tolerance in Hz
     * @param skipFirstXEntries - Number of entries to skip at the beginning of the measurement
     */
    constructor(portPath, dataCallback, minTolerance = 45.0, maxTolerance = 55.0, skipFirstXEntries = 5) {
        this.minTolerance = minTolerance;
        this.maxTolerance = maxTolerance;
        this.skipFirstXEntries = skipFirstXEntries;
        this.callback = dataCallback;
        this.portPath = portPath;
        this.inputBuffer = Buffer.alloc(0); // Create Buffer
        this.sp = new SerialPort({
            path: this.portPath,
            baudRate: 115200,
            autoOpen: false,
        });

        this.sp.on('close', () => {
            console.log('Port Closed');
        });

        /**
         * This function is called when data is received from the serial port.
         * It reads the data and calls the callback function with the values.
         * The values, handed over to the callback function, are:
         * - timeStampInt: The time stamp of the measurement as an integer
         * - frequencyFloat: The frequency of the measurement as a float
         *
         * @param data - Data received from the serial port
         */
        this.sp.on('data', (data) => {
            this.inputBuffer = Buffer.concat([this.inputBuffer, data]);
            if (this.inputBuffer.length === 8) {
                // Wait for 8 bytes
                const timeStampInt = this.inputBuffer.subarray(0, 4).readInt32LE(0);
                const frequencyFloat = this.inputBuffer.subarray(4, 8).readFloatLE(0).toFixed(5);
                this.inputBuffer = Buffer.alloc(0); // Clear Buffer

                const formattedDate = formatDateHumanReadable(timeStampInt);
                console.log(`${formattedDate}, ${frequencyFloat}`);

                // Skip first X entries because of unstable frequency measurement at system start.
                if (this.skipFirstXEntries > 0) {
                    console.warn('Skipping entry because of unstable frequency measurement at system start.');
                    if (frequencyFloat <= this.minTolerance || frequencyFloat >= this.maxTolerance) {
                        console.log(
                            `Frequency ${frequencyFloat} is outside exceeds the tolerance range of ${minTolerance} - ${maxTolerance} Hz.`
                        );
                    }

                    this.skipFirstXEntries -= 1;
                }

                if (this.skipFirstXEntries <= 0) {
                    this.callback(timeStampInt, frequencyFloat);
                }
            }
        });
    }

    /**
     * Opens the serial port and starts reading data
     */
    open() {
        this.sp.open((err) => {
            if (err) {
                return console.log('Error opening port: ', err.message);
            }
            return console.log(`Port Opened: ${this.portPath}`);
        });
    }

    /**
     * Closes the serial port
     */
    close() {
        this.sp.close();
    }
}

module.exports = { SerialPortReader, formatDateHumanReadable };
