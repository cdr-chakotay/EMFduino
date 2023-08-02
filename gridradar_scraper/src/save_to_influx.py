import influxdb_client
import os
import ssl

from datetime import datetime, timezone
from influxdb_client import Point, WriteOptions, WritePrecision

token = os.environ.get("INFLUXDB_TOKEN")
cert_path = os.environ.get("INFLUXDB_CERT_PATH")
org = os.environ.get("INFLUXDB_ORG")
bucket = os.environ.get("INFLUXDB_BUCKET")
url = os.environ.get("INFLUXDB_URL")
batch_size = int(os.environ.get("INFLUXDB_BATCH_SIZE", 30))

def save(epoch, fq, write_api):
    fields = {
        'fq': float(fq)
    }

    tags = {
        'source': 'web_scraper',
        'experiment': 'reference',
        'sensor_unit': 'grid_radar'

    }

    receivedTimestamp = datetime.fromtimestamp(int(epoch)).astimezone(timezone.utc)
    timestamp = receivedTimestamp.isoformat()
    pointDict = {"measurement": "EMF", "time": timestamp, "fields": fields, "tags": tags}

    point = Point.from_dict(pointDict, WritePrecision.S)

    try:
        write_api.write(bucket=bucket, org="emf", record=point)
    except Exception as e:
        print("An error occurred, with Influx DB ... terminating:")
        print(str(e))
        exit(5)

def initWriteAPI():
    '''
    Initializes the InfluxDB write API and returns it
    '''
    if not token or not cert_path or not org or not bucket or not url:
        print("One of the following environment variables is not set:")
        print("INFLUXDB_TOKEN, INFLUXDB_CERT_PATH, INFLUXDB_ORG, INFLUXDB_BUCKET, INFLUXDB_URL")
        exit(2)

    tlsContext = ssl.create_default_context()
    tlsContext.load_verify_locations(cert_path)
    tlsContext.hostname_checks_common_name = False
    tlsContext.check_hostname = False


    write_client = influxdb_client.InfluxDBClient(url=url, token=token, org=org, ssl_context=tlsContext)
    write_api = write_client.write_api(write_options=WriteOptions(batch_size=1))

    print("Initialized InfluxDB write API with the following parameters:")
    print("URL: " + str(url),  "Org: " + str(org), "Bucket: " + str(bucket), "Batch size:" + str(batch_size), sep="\n")
    return write_api