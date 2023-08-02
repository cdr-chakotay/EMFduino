from datetime import *
import requests
import json

url = 'https://api.gridradar.net/query'


def scrape(apiKey, debug=False):
    response = requests.post(url, headers=getHeader(apiKey), json=getData())
    if debug:
        print(response.status_code)
        print(response.headers)
        print(response.content)

    if response.status_code != 200:
        print("Error: " + str(response.status_code))
        from time import sleep
        sleep(10)
        return scrape(True)

    responseJSON = json.loads(response.content.decode('utf-8'))
    return responseJSON


def parseJson(responseJSON):
    dataPoints = responseJSON[0]['datapoints']
    csvLines = []
    pattern = '%Y-%m-%d %H:%M:%S'
    for i in dataPoints:
        fq = i[0]
        ts = i[1]
        epoch = int(datetime.strptime(ts, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc).timestamp())
        formattedDataPoint = (epoch, float(fq), ts)
        csvLines.append(formattedDataPoint)
    print("Scraped Lines: " + str(len(csvLines)) + " - " + datetime.now().strftime('%Y-%m-%d_%H:%M:%S%z'))
    return csvLines


def getHeader(apiKey):
    headers = {
        'Content-type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
    }
    return headers


def getData():
    data = {
        'metric': 'frequency-ucte-median-1s',
        'format': 'json',
        'ts': 'rfc3339',
        'aggr': '1s'
    }
    return data
