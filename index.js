const express = require('express');
const rateLimit = require("express-rate-limit");
const puppeteer = require('puppeteer');
const app = express();

const MongoClient = require('mongodb').MongoClient;
const url = 'mongodb://localhost:27017/';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5
});
 
// applied limit of 5 for all incoming requests from one IP in interval of 15 minutes
app.use(apiLimiter);

app.get('/', async function(req, res){
	
  try{		
		const browser = await puppeteer.launch();
		const page = await browser.newPage();
		// loading the url
		const data = await page.goto('https://medium.com/', { waitUntil: 'networkidle2', timeout: 1000*120 // 2 minutes });
		
		// extracting hrefs from DOM
		const urls = await page.$$eval('a', anchorTag => {
			return anchorTag.map(a => a.href)
		});
		await browser.close();
		  
		const urlsList = [];
			
		// extracting unique url along with its occurrences and params list
		urls.forEach((url) => {
			
			if(urlsList.indexOf(url) <= -1)
			{
				urlsList[url] = {};
				urlsList[url].count = 1;
				let actualUrl = new URL(url);
				let search_params = new URLSearchParams(actualUrl.search); 
				
				let params = [];	
				// iterate over the query parameters
				for(let i of search_params) {
					params.push(i[0]);
				}
				urlsList[url].params = params;
			}else
			{
				urlsList[url].count = urlsList[url].count + 1;
				let actualUrl = new URL(url);
				let search_params = new URLSearchParams(actualUrl.search); 

				// iterate over the query parameters
				for(let i of search_params) {
					if(urlsList[url].params.indexOf(i[0]) <= -1)
					{
						urlsList[url].params.push(i[0]);
					}
				}
			}
		})
		
		const formattedUrlsList = [];
		
		// formatting the urlsList to store in MongoDB
		for(let urlList in urlsList)
		{
			formattedUrlsList.push({
				url : urlList,
				count : urlsList[urlList].count,
				params : urlsList[urlList].params
			})
		}
		
		// storing formattedUrlsList to MongoDB
		storingDataInMongoDB(formattedUrlsList);

		res.send(formattedUrlsList)
	  
  }catch(e){
	  throw e;
  }
	
})

function storingDataInMongoDB(dataArr)
{
	MongoClient.connect(url, function(err, db) {
		
	  if (err) throw err;
	  
	  const dbo = db.db("urlsList");
	  
	  dbo.collection("urls").insertMany(dataArr, function(err, res) {
		  
		if (err) throw err;
		
		console.log("Urls stored successfully.");
		
		db.close();
	  });
	  
	});
}

app.listen('3000')

console.log('Server running on port 3000');

exports = module.exports = app;
