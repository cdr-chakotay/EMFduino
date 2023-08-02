/* eslint-disable class-methods-use-this */
const fs = require('fs');
const stat = require('simple-statistics');

/**
 * This function converts seconds to months, days, hours and seconds
 * @param {number} loggingTimeSpan - time span in seconds
 * @returns The time span in months, days, hours and seconds as String.
 */
function convertSecondsToMDHS(loggingTimeSpan) {
    let seconds = loggingTimeSpan;
    const monthSeconds = 2592000;
    const daySeconds = 86400;
    const hourSeconds = 3600;
    const minuteSeconds = 60;

    const months = Math.floor(seconds / monthSeconds);
    seconds %= monthSeconds;
    const monthString = months ? ` ${months} M` : '';

    const days = Math.floor(seconds / daySeconds);
    seconds %= daySeconds;
    const dayString = days ? ` ${days} d` : '';

    const hours = Math.floor(seconds / hourSeconds);
    seconds %= hourSeconds;
    const hourString = hours ? ` ${hours} H` : '';

    const minutes = Math.floor(seconds / minuteSeconds);
    seconds %= minuteSeconds;
    const minuteString = minutes ? ` ${minutes} m` : '';

    const secondString = seconds ? ` ${seconds} s` : '';

    return (monthString + dayString + hourString + minuteString + secondString).trimStart();
}
/**
 * Class to convert EMF files to other formats.
 */
class ConvertFromEmfFile {
    constructor(file, output, format) {
        this.file = file; // input file path
        this.format = format; // output format
        this.output = output; // output file path
        try {
            this.outFile = fs.openSync(output, 'w');
        } catch (err) {
            console.error(`Could not open out file under ${output}!`);
            console.error(err);
            process.exit(6);
        }
    }

    convert() {
        if (this.format === 'csv') {
            this.convertToCsv();
        } else if (this.format === 'json') {
            this.convertToJson();
        } else if (this.format === 'txt') {
            this.convertToTxt();
        } else if (this.format === 'stats') {
            this.convertToStatistics();
        }
        fs.closeSync(this.outFile);
        console.log(`Converted ${this.file} to ${this.format}.`);
    }

    /**
     * Convert EMF files to the format, specified in the callback.
     * @param formatCallback takes time stamp and frequency as parameters
     */
    convertFiles(formatCallback) {
        // for all files
        let emfFile;
        try {
            emfFile = fs.openSync(this.file, 'r');

            const fileSize = fs.statSync(this.file).size;
            let offsetInFile = 0;
            let lastCompleteTimestamp = 0;
            let timestamp = 0;
            let counter = 10;
            let frequency = 0;
            let buf = Buffer.alloc(0);

            while (offsetInFile < fileSize) {
                if (counter < 9) {
                    // Handle the 9 abbreviated timestamps
                    buf = Buffer.alloc(5);
                    fs.readSync(emfFile, buf, 0, 5, offsetInFile);
                    offsetInFile += 5;
                    timestamp = lastCompleteTimestamp + buf.subarray(0, 1).readInt8();
                    frequency = buf.subarray(1, 5).readFloatLE();
                    formatCallback(timestamp, frequency);
                    buf = Buffer.alloc(0);
                    counter += 1;
                } else {
                    // Handle the 1 complete timestamp per 10 timestamps
                    buf = Buffer.alloc(8);
                    fs.readSync(emfFile, buf, 0, 8, offsetInFile);
                    offsetInFile += 8;
                    lastCompleteTimestamp = buf.subarray(0, 4).readInt32LE();
                    timestamp = lastCompleteTimestamp;
                    frequency = buf.subarray(4, 8).readFloatLE();
                    formatCallback(timestamp, frequency);
                    buf = Buffer.alloc(0);
                    counter = 0;
                }
            }
        } catch (err) {
            console.error('Could not open input file.');
            console.error(err);
            process.exit(7);
        } finally {
            fs.closeSync(emfFile); // close the file after reading
        }
    }

    /**
     * Convert EMF files to CSV format.
     */
    convertToCsv() {
        try {
            fs.writeSync(this.outFile, 'Timestamp,Frequency\n'); // write the header
            let lines = '';
            this.convertFiles((timestamp, frequency) => {
                // write the data to the output file
                lines += `${timestamp},${frequency}\n`;
            });
            fs.writeSync(this.outFile, lines);
        } catch (err) {
            console.error(`Could not write to CSV output file ${this.output}!`);
            console.error(err);
            process.exit(8);
        }
    }

    /**
     * Converts EMF files to JSON
     */
    convertToJson() {
        const valueMap = new Map(); // map to store the data
        try {
            this.convertFiles((timestamp, frequency) => {
                valueMap.set(timestamp, frequency); // add the data to the map
            });
            // convert the map to an object to be able to convert the data object to JSON
            const dataObject = Object.fromEntries(valueMap);
            // write the json string to the output file
            fs.writeSync(this.outFile, JSON.stringify(dataObject, null, 2));
        } catch (err) {
            console.error(`Could not write to JSON output file ${this.output}!`);
            console.error(err);
            process.exit(8);
        }
    }

    /**
     * Convert EMF files to TXT format
     */
    convertToTxt() {
        let lines = '';
        try {
            fs.writeSync(this.outFile, 'Timestamp\t : Frequency:\n'); // write the header
            this.convertFiles((timestamp, frequency) => {
                // write the data to the output file
                lines += `UTC - ${timestamp} : ${frequency} Hz\n`;
            });
            fs.writeSync(this.outFile, lines);
        } catch (err) {
            console.error(`Could not write to TXT output file ${this.output}!`);
            console.error(err);
            process.exit(8);
        }
    }

    /**
     * Converts an EMF file to a statistics with the most relevant measures of the data,
     * including Min, Max, Average, Median, Standard Deviation and Root Mean Square.
     */
    convertToStatistics() {
        let timeLogStart;
        let timeLogEnd;
        const frequencyLogged = [];
        this.convertFiles((timestamp, frequency) => {
            if (timeLogStart === undefined) {
                timeLogStart = timestamp;
            }
            timeLogEnd = timestamp;
            frequencyLogged.push(frequency);
        });
        const numberOfDataPoints = frequencyLogged.length;
        const frequencyLogMin = stat.min(frequencyLogged);
        const frequencyLogMax = stat.max(frequencyLogged);
        const frequencyLogAvg = stat.mean(frequencyLogged);
        const frequencyLogMedian = stat.median(frequencyLogged);
        const frequencyLogStdDev = stat.standardDeviation(frequencyLogged);
        const frequencyRMS = stat.rootMeanSquare(frequencyLogged);
        const timeLogDuration = convertSecondsToMDHS(timeLogEnd - timeLogStart);
        const erroneousValues = frequencyLogged.filter((value) => value < 45.0 || value > 55.0).length;

        const headLine =
            'DataPoints, Minimum, Maximum, Average, Median, Standard Deviation, Root Mean Square,' +
            ' Duration, Erroneous Values\n';
        const dataLine = `${numberOfDataPoints}, ${frequencyLogMin}, ${frequencyLogMax}, ${frequencyLogAvg}, ${frequencyLogMedian}, ${frequencyLogStdDev}, ${frequencyRMS},${timeLogDuration}, ${erroneousValues}\n`;

        try {
            fs.writeSync(this.outFile, `${headLine} + ${dataLine}`, 'utf8');
        } catch (err) {
            console.error(`Could not write to statistics output file ${this.output}!`);
            console.error(err);
            process.exit(8);
        }
    }
}

module.exports = ConvertFromEmfFile;
