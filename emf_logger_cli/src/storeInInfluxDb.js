/* eslint-disable camelcase */
const { InfluxDB, Point, DEFAULT_WriteOptions } = require('@influxdata/influxdb-client');
const https = require('https');
const fs = require('fs');

/**
 * Class to store the read values in the InfluxDB format. It uses the influxdb-client library.
 * @param url InfluxDB URL url:port
 * @param token InfluxDB Token
 * @param org InfluxDB Organization
 * @param bucket InfluxDB Bucket
 * @param experimentNameName Name of the experiment, will be used as tag
 * @param sensor_unit Name of the device, will be used as tag
 * @param certPath Path to the certificate file
 */
class StoreInInfluxDb {
    constructor(url, token, certPath, org, bucket, experimentName, sensorUnit) {
        this.url = encodeURI(url);
        this.token = encodeURI(token);
        this.certPath = certPath;

        this.bucket = bucket;
        this.org = org;

        this.batchSize = Number(process.env.INFLUXDB_BATCH_SIZE) || DEFAULT_WriteOptions.batchSize;

        this.experimentName = experimentName;
        this.sensorUnit = sensorUnit;
        this.agent = new https.Agent({
            ca: fs.readFileSync(this.certPath),
            rejectUnauthorized: false,
        });

        this.writeOptions = {
            batchSize: this.batchSize,
        };

        console.log(`Connecting to InfluxDB at ${this.url} with token ${this.token}`);
        this.writeApi = new InfluxDB({
            url: this.url,
            token: this.token,
            transportOptions: { agent: this.agent },
        }).getWriteApi(org, bucket, 'ns', this.writeOptions);
    }

    /**
     * Stores the read values in the InfluxDB format.
     * @param timeStamp POSIX time stamp in seconds
     * @param frequency Frequency in Hz
     */
    store(timeStamp, frequency) {
        try {
            const date = new Date(timeStamp * 1000);
            const point = new Point('EMF')
                .measurement('EMF')
                .timestamp(date)
                .floatField('fq', frequency)
                // .intField('epoch_time', timeStamp) TODO:Permanent removal of epoch_time
                .tag('source', 'emf_device')
                .tag('experiment', this.experimentName)
                .tag('sensor_unit', this.sensorUnit);
            console.log(point);
            this.writeApi.writePoint(point);
        } catch (err) {
            console.error('An error occurred while writing to InfluxDB.');
            console.error(err);
            process.exit(9);
        }
    }

    close() {
        this.writeApi.close();
    }
}

module.exports = StoreInInfluxDb;
