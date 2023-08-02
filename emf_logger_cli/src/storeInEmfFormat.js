const fs = require('fs');
const path = require('path');
const spr = require('./serialPortReader');

class StoreInEmfFormat {
    constructor(storageDirectoryPath, serialPortName) {
        this.outputBuffer = Buffer.alloc(0); // Create Buffer
        this.initialTimeStamp = 0; // Timestamp of first data point
        this.lastLoggedTimeStamp = 0; // Last complete timestamp written to file
        this.storeOperationsUntilTimestamp = 0; // Number of data points until next timestamp is stored
        this.nextFullHour = 0; // Date and time of first data point
        this.serialPortName = serialPortName;
        this.storageDirectoryPath = path.resolve(storageDirectoryPath);
        if (!fs.existsSync(this.storageDirectoryPath)) {
            throw new Error(`Directory ${this.storageDirectoryPath} does not exist.`);
        }
    }

    store(timeStamp, frequency) {
        // If this is the first data point, set initial timestamp of the current file and next full hour
        const dateNow = new Date(timeStamp * 1000);
        if (this.initialTimeStamp === 0) {
            this.initialTimeStamp = timeStamp;
            this.nextFullHour = this.getNextFullHourDateTime(dateNow);
        }

        // Ensure a new file is created every full hour
        if (dateNow.getTime() > this.nextFullHour.getTime()) {
            // Reset initial timestamp of the current file and the next full hour as well as the counter variables.
            this.initialTimeStamp = timeStamp;
            this.nextFullHour = this.getNextFullHourDateTime(dateNow);
            this.lastLoggedTimeStamp = 0;
            this.storeOperationsUntilTimestamp = 0;
        }

        if (this.storeOperationsUntilTimestamp <= 0) {
            this.outputBuffer = Buffer.alloc(8); // 4 bytes for timestamp, 4 bytes for frequency
            this.lastLoggedTimeStamp = timeStamp;
            this.outputBuffer.writeUInt32LE(timeStamp, 0);
            this.outputBuffer.writeFloatLE(frequency, 4);
            this.storeOperationsUntilTimestamp = 10;
        } else {
            this.outputBuffer = Buffer.alloc(5); // 1 byte for offset between last timestamp and current time stamp, 4 bytes for frequency
            this.outputBuffer.writeUint8(timeStamp - this.lastLoggedTimeStamp, 0);
            this.outputBuffer.writeFloatLE(frequency, 1);
        }
        this.storeOperationsUntilTimestamp -= 1;

        try {
            // Write Buffer to File in Storage Directory with Timestamp and Serial Port Name
            fs.appendFileSync(
                `${this.storageDirectoryPath}/${spr.formatDateHumanReadable(this.initialTimeStamp)}-${
                    this.serialPortName
                }.emf`,
                this.outputBuffer
            );
        } catch (err) {
            console.error('Could not write to EMF output file.');
            console.error(err);
            process.exit(8);
        }

        this.outputBuffer = Buffer.alloc(0); // Clear Buffer
    }

    /**
     * Returns a Date object for the next full hour.
     * @param timeStamp current epoch time in seconds
     * @returns {Date}
     */
    getNextFullHourDateTime(dateNow) {
        const millisecondsPerHour = 1000 * 60 * 60;
        let nextHour = new Date(Math.ceil(dateNow.getTime() / millisecondsPerHour) * millisecondsPerHour);

        // If the next full hour is the same as the current hour, add one hour
        if (dateNow.getHours() === nextHour.getHours()) {
            nextHour = new Date(
                Math.ceil((dateNow.getTime() + millisecondsPerHour) / millisecondsPerHour) * millisecondsPerHour
            );
        }

        return nextHour;
    }
}

module.exports = StoreInEmfFormat;
