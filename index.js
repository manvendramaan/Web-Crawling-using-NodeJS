const express = require('express');
const request = require('request');
const HTMLParser = require('node-html-parser');
const rateLimit = require("express-rate-limit");
const app = express();

const MongoClient = require('mongodb').MongoClient;
const url = 'mongodb://localhost:27017/';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5
});
 
// applied limit of 5 for all incoming requests from one IP in interval of 15 minutes
app.use(apiLimiter);

app.get('/', function(req, res){
	
	const url = 'https://medium.com/';

    request(url, function(error, response, body){
		if(error)
		{
			throw error;
		}
		let root = HTMLParser.parse(body);
		let raw_data = root.querySelectorAll('a');
		
	    	// extracting the urls from anchor tag
		const urls = [];
		for(let i=0; i < raw_data.length; i++)
		{
			 urls.push(raw_data[i].rawAttrs.split('href="')[1].split('"')[0]);
		}
		
		const urlsList = [];
		
		// filtering unique url along with its occurrences and params list
		urls.forEach((url) => {
			
			if(urlsList.indexOf(url) <= -1)
			{
				urlsList[url] = {};
				urlsList[url].count = 1;
				try{
					let actualUrl = new URL(url);
					let search_params = new URLSearchParams(actualUrl.search); 
					
					let params = [];	
					// iterate over the query parameters
					for(let i of search_params) {
						params.push(i[0]);
					}
					urlsList[url].params = params;
				}catch(e)
				{
					console.error(e)
				}
			}else
			{
				urlsList[url].count = urlsList[url].count + 1;
				try{
					let actualUrl = new URL(url);
					let search_params = new URLSearchParams(actualUrl.search); 
	
					// iterate over the query parameters
					for(let i of search_params) {
						if(urlsList[url].params.indexOf(i[0]) <= -1)
						{
							urlsList[url].params.push(i[0]);
						}
					}
				}catch(e)
				{
					console.error(e)
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
	});
 
})

function storingDataInMongoDB(dataArr)
{
	// connecting MongoDB
	MongoClient.connect(url, function(err, db) {
		
	  if (err) throw err;
	  
	  const dbo = db.db("urlsList");
	  // storing dataArr in MongoDB
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
