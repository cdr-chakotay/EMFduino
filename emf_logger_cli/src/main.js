#!/usr/bin/env node

// emf_logger_cli  Copyright (C) 2023  Florian Künzig
const yargs = require('yargs');
const StoreInEmfFormat = require('./storeInEmfFormat');
const StoreInInfluxDb = require('./storeInInfluxDb');
const spr = require('./serialPortReader');
const ConvertFromEmfFile = require('./convertFromEmfFile');
const Helper = require('./staticHelperScripts');

// Main Actions
/**
 * Logging function. It creates a serial port reader and a storeInEmfFormat object.
 * It saves the read values in the EMF format.
 * @param serialPortName
 * @param logDirectory
 */
function log(serialPortName, logDirectory) {
    const portPath = `/dev/${Helper.getSerialPort(serialPortName)}`; // Get Serial Port Path
    let callback;

    if (logDirectory) {
        const logDirectoryCorrected = Helper.resolveHomeDir(logDirectory);
        const storeInEmfFormat = new StoreInEmfFormat(logDirectoryCorrected, serialPortName); // Create EMF File

        /**
         * Callback function for serial port reader. It hands over the read values to the storeInEmfFormat object.
         * @param timeStampInt  Time Stamp in unix time format
         * @param frequencyFloat Frequency in Hz
         */
        callback = (timeStampInt, frequencyFloat) => {
            storeInEmfFormat.store(timeStampInt, frequencyFloat);
        };
    } else {
        // If no log directory is provided, do no log.
        callback = () => {};
    }

    const serialPortReader = new spr.SerialPortReader(portPath, callback); // Create Serial Port Reader
    serialPortReader.open();
}

/**
 * Logging function with database support
 * @param port Serial Port, the sensor is connected to.
 * @param url URL of the influxDB Instance
 * @param token Auth Token
 * @param org Organization name inside of influxdb
 * @param bucket bucket name
 * @param experimentName name of the current experiment
 * @param sensorUnit name of the sensor unit
 */
function logdb(port, url, token, certPath, org, bucket, experimentName, sensorUnit) {
    const portPath = `/dev/${Helper.getSerialPort(port)}`; // Get Serial Port Path

    const storeInInfluxDb = new StoreInInfluxDb(url, token, certPath, org, bucket, experimentName, sensorUnit);
    const callback = (timeStampInt, frequencyFloat) => {
        storeInInfluxDb.store(timeStampInt, frequencyFloat);
    };

    const serialPortReader = new spr.SerialPortReader(portPath, callback); // Create Serial Port Reader
    serialPortReader.open();
}

function convert(input, output, format, recursive) {
    const extension = 'emf';

    if (!recursive) {
        // if you do not want to convert all emf files in a folder

        let outputPath;

        if (!output) {
            // If no output is specified, use the input file name
            outputPath = Helper.deriveOutputPathFromInputPath(input, format);
        } else {
            outputPath = output;
        }

        outputPath = Helper.resolveHomeDir(outputPath);
        const file = Helper.getFiles(input, extension);
        const convertedEmf = new ConvertFromEmfFile(file[0], outputPath, format);
        convertedEmf.convert();
    } else {
        const outputFolder = Helper.resolveHomeDir(output);
        const files = Helper.getFiles(input, extension, recursive);
        const filesCount = files.length;

        if (filesCount === 0) {
            console.error(`No files found in folder! ${input}`);
            process.exit(8);
        }

        for (let i = 0; i < filesCount; i++) {
            const outputPath = Helper.getOutputPathForRecursiveConversion(
                files[i],
                `.${extension}`,
                outputFolder,
                format
            );
            const convertedEmf = new ConvertFromEmfFile(files[i], outputPath, format);
            convertedEmf.convert();
        }
    }
}

// Define CLI Arguments
// log to file
yargs.usage('\nUsage: $0 [cmd] <args>').alias('h', 'help');
yargs
    .command(
        'log',
        'Log EMF data to binary file in the *.emf format',
        {
            port: {
                describe: 'Name of the Serial port, the sensor device is connected to.',
                demandOption: true,
                type: 'string',
                alias: 'p',
            },
            dir: {
                describe: 'Logging Directory - Log files are saved here, if provided',
                demandOption: false,
                type: 'string',
                alias: 'd',
            },
        },
        (argv) => {
            const portName = argv.port;
            const logDir = argv.dir;
            log(portName, logDir);
        }
    )
    .example('node $0 log -p /dev/ttyUSB0 -d /home/pi/EMF-Logger/Logs');

// log to InfluxDatabase
yargs
    .command(
        'logdb',
        'Log EMF data to an InfluxDB instance, tags and fields are predefined. ' +
            'The following tags are used: "source": "emf_device", "experiment": ' +
            'Name of the experiment, "sensor_unit": Name of the device. ' +
            'The following fields are used: "frequency", "timeStamp".',
        {
            port: {
                describe: 'Name of the Serial port, the sensor device is connected to.',
                demandOption: true,
                type: 'string',
                alias: 'p',
            },

            url: {
                describe: 'Database URL, Format url:port, defaults to "https://localhost:8086".',
                demandOption: false,
                type: 'string',
                alias: 'u',
            },

            token: {
                describe:
                    'Database access token, either define it as parameter or export it as environment variable under key "INFLUXDB_TOKEN".',
                demandOption: false,
                type: 'string',
                alias: 't',
            },

            certPath: {
                describe:
                    'Path to the public part of the TLS certificate. Either define it as parameter or export it as environment variable under key "INFLUXDB_CERT_PATH".',
                demandOption: false,
                type: 'string',
                alias: 'c',
            },

            org: {
                describe:
                    'Influx DB Organization. Either define it as parameter or export it as environment variable under key "INFLUXDB_ORG".',
                demandOption: false,
                type: 'string',
                alias: 'o',
            },

            bucket: {
                describe:
                    'Name of the bucket to store the data in. Either define it as parameter or export it as environment variable under key "INFLUXDB_BUCKET".',
                default: 'emf_data',
                demandOption: false,
                alias: 'b',
            },

            experiment_name: {
                describe: 'Name of the current experiment, will be used as tag.',
                demandOption: true,
                alias: 'e',
            },

            sensor_unit: {
                describe: 'Name of the data source, will be used as tag.',
                demandOption: true,
                alias: 's',
            },
        },
        (argv) => {
            const portName = argv.port;
            let dbUrl = argv.url;
            let tokenDb = argv.token;
            let certPathDb = argv.certPath;
            let orgName = argv.org;
            let bucketName = argv.bucket;
            const experimentName = argv.experiment_name;
            const sensorUnit = argv.sensor_unit;

            // Defining defaults
            if (!dbUrl) {
                dbUrl = process.env.INFLUXDB_URL;
                if (!tokenDb) {
                    console.error(
                        'Please provide url as argument or export it as Env Variable under Key INFLUXDB_URL.'
                    );
                }
            }

            if (!tokenDb) {
                tokenDb = process.env.INFLUXDB_TOKEN;
                if (!tokenDb) {
                    console.error(
                        'Please provide the DB Access Token as argument or export it as Env Variable under Key INFLUXDB_TOKEN.'
                    );
                }
            }

            if (!certPathDb) {
                certPathDb = process.env.INFLUXDB_CERT_PATH;
                if (!certPathDb) {
                    console.error(
                        'Please export the path to the public part of the TLS certificate to Env-Key INFLUXDB_CERT_PATH or provide it as argument.'
                    );
                }
            }

            if (!orgName) {
                orgName = process.env.INFLUXDB_ORG;
                if (!orgName) {
                    console.error(
                        'Please export the name of the organization to Env-Key INFLUXDB_ORG or provide it as argument.'
                    );
                }
            }

            if (!bucketName) {
                bucketName = process.env.INFLUXDB_BUCKET;
                if (!bucketName) {
                    console.error(
                        'Please export the name of the bucket to Env-Key INFLUXDB_BUCKET or provide it as argument.'
                    );
                }
            }

            if (!experimentName) {
                console.error('Please provide a name for the experiment.');
                process.exit(1);
            }

            if (!sensorUnit) {
                console.error('Please provide the name of the sensor unit.');
                process.exit(1);
            }

            logdb(portName, dbUrl, tokenDb, certPathDb, orgName, bucketName, experimentName, sensorUnit);
        }
    )
    .example(
        'node $0 logDb -p /dev/ttyUSB0 -u https://localhost:8086 -t myTokenIsWEAK -c /home/user/tls.crt -o emf -b emf_data -m TestMeasurement -s standardSensor1'
    );

// convert file
yargs
    .command(
        'convert',
        'Convert EMF binary file to another supported file format',
        {
            format: {
                describe: 'Output Format, if not specified, the file extension is used',
                demandOption: false,
                type: 'string',
                alias: 'f',
                choices: ['csv', 'json', 'txt', 'stats'],
            },
            input: {
                describe: 'Path to Input File or Folder',
                demandOption: true,
                type: 'string',
                alias: 'i',
            },
            output: {
                describe:
                    'Path to Output File or Folder, if no output format is specified, its file extension is used.',
                demandOption: false,
                type: 'string',
                alias: 'o',
            },
            recursive: {
                describe: 'Convert all files in the input folder recursively',
                demandOption: false,
                type: 'boolean',
                alias: 'r',
            },
        },
        (argv) => {
            if (!argv.output && !argv.format) {
                console.error('\nPlease specify an output file and / or format.');
                yargs.showHelp();
                process.exit(1);
            } else {
                let { format } = argv;
                let { output } = argv;

                if (!argv.recursive) {
                    if (!format) {
                        // If no format is specified, use the file extension
                        const matched = argv.output.match(
                            '((\\w*\\.txt$)|(\\w*\\.json$)|(\\w*\\.csv$)|(\\w*\\.stats$)|(\\w*\\.stats.csv$))'
                        );
                        if (matched) {
                            const lastMatch = matched[0]; // Get last match
                            const detectStats = lastMatch.match('(\\w*\\.stats.csv$)'); // Get last match
                            if (!detectStats) {
                                format = lastMatch.substring(lastMatch.lastIndexOf('.') + 1); // Get file extension
                            } else {
                                format = 'stats';
                            }
                        } else {
                            console.error(
                                '\nPlease specify an output format. \nSupported formats are: csv, json, txt and stats.'
                            );
                            yargs.showHelp();
                            process.exit(7);
                        }
                    }
                } else {
                    // You need a format for recursive conversion
                    if (!format) {
                        console.error(
                            '\nPlease specify an output format. \nSupported formats are: csv, json, txt and stats.'
                        );
                        yargs.showHelp();
                        process.exit(7);
                    }
                    // You need an output folder for recursive conversion
                    if (!output) {
                        output = argv.input; // If input is a folder is checked later inside of convert();
                    }
                }
                console.log(`\nConverting file(s) to ${format} format...`);
                convert(argv.input, output, format, argv.recursive);
            }
        }
    )
    .example('node $0 convert -f csv -i ~/1672527600-ttyUSB0.emf  -o ~/myConvertedTable.cs');

// Add licensing information
yargs
    .command(
        'license',
        "Show information about the tool's license",
        {
            warranty: {
                describe: 'Show warranty information',
                type: 'boolean',
                alias: 'w',
                conflicts: ['conditions'],
            },
            conditions: {
                describe: 'Show conditions of the license',
                type: 'boolean',
                alias: 'c',
                conflicts: ['warranty'],
            },
        },
        (argv) => {
            Helper.printLicenseInformation(argv.warranty, argv.conditions);
        }
    )
    .example('node $0 show -w');

// Add epilogue to help message
yargs.epilogue(
    `Tool Description:` +
        `\n  emf_logger is a lightweight tool to log EMF data from a EMF sensor to a binary file in the EMF format.` +
        `\n  It can also convert EMF files to other formats.` +
        `\n\n  ${Helper.copyRightNotice}`
);

yargs.demandCommand().recommendCommands().locale('en').strict().parse(); // Parse CLI Arguments and add the standard help command
