from datetime import *
import requests as requests
import xml.etree.ElementTree as et

def scrape(url) -> tuple:
    response = requests.get(url)
    xml_data = ''

    if response.status_code != 200:
        print("Error: reaching micromax -f GPS device" + str(response.status_code))
        raise RuntimeError('micormax -f GPS Device could not be reached')
    
    if len(response.content) < 5:
        print("Error Received empty response.")
        raise RuntimeError('micromax -f GPS Device sent empty response')
    else: 
        xml_data = response.content

    root = et.fromstring(xml_data)
    frequency = float(root.find('frequenz').text)
    utc_string = root.find('datumzeit_utc').text

    timeStamp = datetime.strptime(utc_string, "%d.%m.%Y %H:%M:%S").replace(tzinfo=timezone.utc)
    epoch = int(timeStamp.timestamp())
    isoTimeStamp = timeStamp.isoformat()

    csvLine = (epoch, frequency, isoTimeStamp)
    return csvLine
