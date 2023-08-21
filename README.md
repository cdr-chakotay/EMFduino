# EMFduino

EMFduino is a project about measuring Electric Mains Frequency (EMF) with low-cost Arduino hardware as measurement device and a Raspberry Pi Database Server and measurement interpretation computer (Also other computers are possible).
This repository contains the software for the measurement device and the middleware to connect the measurement device to the database server.
Also, the helper tools for querying and saving output from the Gridradar Database and saving data of a micromax-fgps PMU are included.

The end targeted result is an Influx Database with Electric Mains Frequency measurements for every second of the day.

This project has no commercial purpose and should only be used for research and educational purposes.

## Installation

### Prerequisites

1. Install Arduino IDE v2, Python and Node.js on your machine.

2. Checkout repo with:

```bash
git clone <repo-url>
```

### Install necessary libraries

1. Install necessary python packages:

```bash
pip3 install requests influxdb-client-python
```

2. Change in the directory of the emf_logger_cli and install the necessary node packages:

```bash
cd emf_logger_cli
npm install
```

3. Copy the folder `rtc_methods` with its content to the Arduino library folder. The location of the Arduino library folder can be found in the Arduino IDE under `File -> Preferences -> Sketchbook location`.

4. Install the Arduino library `SparkFun_Ublox_Arduino_Library` from the Arduino IDE library manager.

5. Copy the emf_device folder to the Arduino library folder. The location of the Arduino library folder can be found in the Arduino IDE under `File -> Preferences -> Sketchbook location`.

### DataBase Setup

Please set up a [InfluxDB](https://www.influxdata.com/products/influxdb/) v2 instance and create a bucket for the data.
Also configure a retention policy to not delete data, to be able to query it later.
The generation of an API token is also necessary to be able to write data to the database.

## Configuration and usage of client software

The software is configurable and usable via command line interface. Despite there are multiple operation modes possible, this tutorial focuses on the most important parts.

### Configuration

The configuration of the software components, especially the InfluxDatabaseConnection is done via environment variables:
The following table lists the environment variables that are used by the software components and are necessary to be set.


<!-- prettier-ignore -->
**Tabel 1:** *Environment variables for configuration and operation of the measurement software*
| Variable name       |     Used by       | Description  |
| ------------------- | ----------------- | ------------ |
| GRIDRADAR_TOKEN     | gridradar_scraper | Authentication token for the Gridradar API                                              |
| INFLUXDB_BATCH_SIZE | all               | Number of measurement points to buffer before writing them to the database together     |
| INFLUXDB_BUCKET     | all               | Name of the target bucket in the InfluxDB                                               |
| INFLUXDB_CERT_PATH  | all               | Path to a TLS certificate file with the public part of the certificate of the InfluxDB. |
| INFLUXDB_ORG        | all               | Name of the organization unit within the InfluxDB                                       |
| INFLUXDB_TOKEN      | all               | Authentication token for the InfluxDB                                                   |
| INFLUXDB_URL        | all               | URL under which the InfluxDB is reachable in the schema: https://<URL                   | IP>:PORT |
| MICROMAX_URL        | micromax_scraper  | URL to the web interface of the micromax_fgps device in the format http://<URL          | IP>:PORT |

## Usage

For using the main functionality of the software, the following steps and materials are necessary:

### Using the EMFduino as measurement device

-   A precise time source (e.g. GPS, NTP, RTC) pre-configured is either a DS3231 or an Ublox GPS module and connect its I2C-Bus to the Arduino's Pins A4 and A5
-   Get a 1 Hz signal from the RTC to Pin D3 of the Arduino
-   Connect a 3 - 5 V transformed and full bridge rectified mains frequency signal to the Arduino Pin D2
-   The following circuit is recommended for setting up an EMFduino:
    | ![EMFduino_schematic](https://github.com/cdr-chakotay/EMFduino/assets/60937022/5cf2b62b-9f43-4fbb-bb54-e75205f63704) |
    |:--:| 
    | **Figure 1:** *Schematic circuit diagram of an EMFduino measuring device*  |
-  Ensure a measurement environment free of voltage peaks at room temperature
-   Connect the Arduino to the computer via USB
-   Make sure the environment variables are set correctly (see Tab. 1)
-   Start the emf_logger_cli and hand it over the necessary port number the Arduino is connected to (e.g. COM3 on Windows or /dev/ttyACM0 on Linux)
  
### Using another Measurement Device

-   Make sure the environment variables are set correctly
-   Start the emf_logger_cli and hand it over the necessary port number the Arduino is connected to (e.g. COM3 on Windows or /dev/ttyACM0 on Linux)
-   The measurement device has to send the measurement data as binary encoded message with the following content each second:
    -   `Uint32LE` - POSIX timestamp in seconds
    -   `Float32LE` - Frequency in Hz

## Declaration of third party software usage

This software uses third party software as part of its functionality. The following table lists the used libraries, their licenses and the parts of the software that use them. It only shows libraries, which are not a part of the standard library and also not the language/framework or part of the listed libraries itself.

**Tabel 2:** *Overview of used 3rd party software*
| Library                                                                                      | License      | Usage                               | Language/Framework |
| -------------------------------------------------------------------------------------------- | ------------ | ----------------------------------- | ------------------ |
| [glob](https://github.com/isaacs/node-glob)                                                  | ISC          | emf_logger_cli                      | node.js            |
| [influxdb-client-js](https://github.com/influxdata/influxdb-client-js)                       | MIT          | emf_logger_cli                      | node.js            |
| [influxdb-client-python](https://github.com/influxdata/influxdb-client-python)               | MIT          | gridradar_scraper, micromax_scraper | python             |
| [requests](https://github.com/psf/requests)                                                  | Apache 2.0   | gridradar_scraper, micromax_scraper | python             |
| [node-serialport](https://github.com/serialport/node-serialport)                             | MIT          | emf_logger_cli                      | node.js            |
| [simple-statistics](https://github.com/simple-statistics/simple-statistics)                  | ISC          | emf_logger_cli                      | node.js            |
| [SparkFun_Ublox_Arduino_Library](https://github.com/sparkfun/SparkFun_Ublox_Arduino_Library) | CC BY-SA 4.0 | rtc_methods                         | C++                |
| [yargs](https://github.com/yargs/yargs)                                                      | MIT          | emf_logger_cli                      | node.js            |

## License

This project was authored by Florian Künzig (2023) during a Bachelor Thesis at the University of Applied Sciences in Mittweida, Germany. The project is licensed under the GPL-3.0 License. See the LICENSE files for more information.
