import axios from 'axios';
import {
  IconButton,
  TextField,
  InputAdornment,
  AppBar,
  Toolbar,
  Select,
  MenuItem,
  Box,
  ThemeProvider,
  createTheme,
} from '@mui/material';
import { AttachMoney, Refresh, MyLocation } from '@mui/icons-material';
import { useRef, useState } from 'react';
import {
  YMaps,
  Map,
  Placemark,
  GeolocationControl,
  ZoomControl,
  Clusterer,
} from 'react-yandex-maps';
import useGeolocation from 'react-hook-geolocation';
import './styles.css';

const currencySigns = {
  USD: '$',
  RUB: '₽',
  EUR: '€',
};

const currencyAmountColors = {
  USD: {
    medium: 1000,
    max: 5000,
  },
  RUB: {
    medium: 100000,
    max: 300000,
  },
  EUR: {
    medium: 1000,
    max: 5000,
  },
};

function getCurrencyAmountColor(currency, amount) {
  const colors = currencyAmountColors[currency];

  if (amount >= colors.max) {
    return 'green';
  }

  if (amount < colors.medium) {
    return 'red';
  }

  return 'yellow';
}

async function getATMs(bounds, zoom) {
  const { data } = await axios.post(
    'https://api.tinkoff.ru/geo/withdraw/clusters',
    {
      zoom,
      fullInfo: true,
      bounds: {
        bottomLeft: {
          lat: bounds[0][0],
          lng: bounds[0][1],
        },
        topRight: {
          lat: bounds[1][0],
          lng: bounds[1][1],
        },
      },
      filters: {
        pointTypes: ['ATM'],
        showUnavailable: false,
        currencies: ['USD'],
        banks: ['tcs'],
      },
    },
  );

  return data.payload.clusters;
}

export default function App() {
  const geolocation = useGeolocation({
    enableHighAccuracy: true,
    maximumAge: 15000,
    timeout: 12000,
  });
  const mapRef = useRef();
  const [atms, setAtms] = useState([]);
  const [currency, setCurrency] = useState('USD');
  const [minAmount, setMinAmount] = useState('');

  const refreshData = async () => {
    const bounds = mapRef.current?.getBounds();
    const zoom = mapRef.current?.getZoom();

    if (bounds && zoom) {
      console.log('refresh');
      setAtms(await getATMs(bounds, zoom));
    }
  };

  const changeCurrency = (event) => {
    setCurrency(event.target.value);
  };

  const changeMinAmount = (event) => {
    setMinAmount(event.target.value);
  };

  const onBoundsChange = ({
    originalEvent: { oldCenter, newCenter, oldZoom, newZoom, oldBounds },
  }) => {
    const isZoomChanged = oldZoom !== newZoom;
    const boundsWidth = oldBounds[1][1] - oldBounds[0][1];
    const boundsHeight = oldBounds[1][0] - oldBounds[0][0];
    const isBoundsChanged =
      Math.abs(oldCenter[0] - newCenter[0]) / boundsHeight > 0.15 ||
      Math.abs(oldCenter[1] - newCenter[1]) / boundsWidth > 0.15;

    if (isZoomChanged || isBoundsChanged) {
      refreshData();
    }
  };

  const locateMe = () => {
    mapRef.current.panTo([geolocation.latitude, geolocation.longitude]);
  };

  const darkTheme = createTheme({
    palette: {
      mode: 'dark',
    },
  });

  return (
    <ThemeProvider theme={darkTheme}>
      <Box height="var(--app-height)" display="flex" flexDirection="column">
        <AppBar position="static">
          <Toolbar variant="dense">
            <Box sx={{ flexGrow: 1, display: 'flex' }}>
              <TextField
                value={minAmount}
                onChange={changeMinAmount}
                type="number"
                size="small"
                placeholder="0"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AttachMoney />
                    </InputAdornment>
                  ),
                }}
                sx={{ marginRight: 2 }}
              />
              <Select value={currency} onChange={changeCurrency} size="small">
                <MenuItem value="USD">USD</MenuItem>
                <MenuItem value="RUB">RUB</MenuItem>
                <MenuItem value="EUR">EUR</MenuItem>
              </Select>
            </Box>
            <IconButton onClick={locateMe}>
              <MyLocation />
            </IconButton>
            <IconButton onClick={refreshData}>
              <Refresh />
            </IconButton>
          </Toolbar>
        </AppBar>
        <YMaps query={{ mode: 'debug' }}>
          <Map
            width="100vw"
            height="100%"
            defaultState={{ center: [55.74, 37.62], zoom: 11 }}
            instanceRef={mapRef}
            onLoad={refreshData}
            onBoundsChange={onBoundsChange}>
            {atms.map((cluster) => (
              <Clusterer key={cluster.id}>
                {cluster.points
                  .filter(
                    ({ limits }) =>
                      limits.find((limit) => limit.currency === currency)
                        ?.amount >= minAmount,
                  )
                  .map((point) => {
                    const { openTime, closeTime } = point.workPeriods[
                      new Date().getDay()
                    ];

                    const amount = point.limits.find(
                      (limit) => limit.currency === currency,
                    ).amount;

                    return (
                      <Placemark
                        key={point.id}
                        modules={['geoObject.addon.balloon']}
                        geometry={[point.location.lat, point.location.lng]}
                        properties={{
                          balloonContentHeader: '',
                          balloonContentBody: `${point.installPlace}<br/>${openTime} - ${closeTime}<br/><a href="yandexmaps://maps.yandex.com/?rtext=${point.location.lat}, ${point.location.lng}" >Route</a>`,
                          balloonContentFooter: point.limits
                            .map(
                              ({ currency, amount }) =>
                                `${currency}: ${amount}`,
                            )
                            .join('<br/>'),
                          iconContent: `${amount}${currencySigns[currency]}`,
                        }}
                        options={{
                          preset: 'islands#yellowStretchyIcon',
                          iconColor: getCurrencyAmountColor(currency, amount),
                        }}
                      />
                    );
                  })}
              </Clusterer>
            ))}
            {!geolocation.error && geolocation.latitude && (
              <Placemark
                geometry={[geolocation.latitude, geolocation.longitude]}
                options={{
                  preset: 'islands#geolocationIcon',
                  iconColor: 'green',
                }}
              />
            )}
            <ZoomControl />
            <GeolocationControl options={{ visible: false }} />
          </Map>
        </YMaps>
      </Box>
    </ThemeProvider>
  );
}
