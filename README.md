# smart-progressbar.js
This is a very smart progress bar, which itself decides when it appears depending on the load.

## Usage
Download ***smart-progressbar.js*** manually or install with bower
```bash
$ bower install smart-progressbar -S
```  
Include ***smart-progressbar.js*** ( or ***smart-progressbar.min.js***) in your website.
```html
<script type="text/javascript" src="bower_components/smart-progressbar/smart-progressbar.min.js"></script>
```

Set ***smart-progressbar*** as a dependency in your module
```javascript
var app = angular.module('app', ['smart-progressbar']);
```    
## That's it!


## Options

To configure the progress bar, just create a constant:
```javascript
app.constant('spOptionsDefaults', {
        'background-color': 'black',
        'z-index': '2147483647',
        transition: 'all 0.5s ease',
        opacity: '0.5',
        sensitivity: 500,
        delayTrashHold: 50,
        minDuration: 700,
        spinner: 'spinner3' //available options: 'spinner1', 'spinner2', 'spinner3', 'spinner4', 'spinner5', 'spinner6' 
    })
```    
