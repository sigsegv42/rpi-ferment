# Raspberry Pi Fermentation temperature logging & control application
# (c) Joshua Farr <j.wgasa@gmail.com>

module.exports = {
	apiPort: 3010
	ioPort: 6001
	pollFrequency: 1000
	sensorUnit: 'farenheight'
	sensors: [
		{
			name: 'ambient'
			label: 'Ambient'
			id: '000004bd611f'
			type: 'ambient'
		},
		{
			name: 'fermenter_1'
			label: 'Fermenter #1'
			id: '000004bcb49a'
			type: 'fermenter'
			gpio: 25
			control: 'heater'
			cycle: 0
		},
		{
			name: 'fermenter_2'
			label: 'Fermenter #2'
			id: '000004bd0d7b'
			type: 'fermenter'
			gpio: 8
			control: 'heater'
			cycle: 0
		}
	]
}