(function(){

// *********** FAKE SERVER START *****************
// Sets up a fake server that responds to AJAX requests made to /persons.
var fakeServer = sinon.fakeServer.create();
fakeServer.autoRespond = true;  
  
// Set up a sequence to be used for ID generation.
var sequence = 3;
  
// Set up an array of objects
var fakeServerObjects = [
  { "id": 0, "firstName":"John" , "lastName":"Doe" }, 
  { "id": 1, "firstName":"Anna" , "lastName":"Smith" }, 
  { "id": 2, "firstName":"Peter" , "lastName": "Jones" }
];

function getObjFromUrl(xhr) {
  var index = parseInt(/persons\/([0-9])/.exec(xhr.url)[1], 10);
  var obj = fakeServerObjects.filter(function(val) {
    return val.id == index;
  });
  if (obj && obj.length && obj.length == 1) {
    return obj[0];
  }
  return null;
}

function respondError(xhr) {
  xhr.respond(500, {'Content-Type': 'application/json'}, JSON.stringify({msg: 'error'}));
}

function respondJSON(xhr, obj) {
  xhr.respond(200, {'Content-Type': 'application/json'}, JSON.stringify(obj));
}

fakeServer.respondWith('GET', /persons\/[0-9]/, function(xhr, id) {
  console.info('FAKESERVER: Received GET: ' + xhr.url);
  var obj = getObjFromUrl(xhr);
  if (obj) respondJSON(xhr, obj);
  else respondError(xhr);
});
fakeServer.respondWith('GET', /persons\/?$/, function(xhr, id) {
  console.info('FAKESERVER: Received GET: ' + xhr.url);
  respondJSON(xhr, fakeServerObjects);
});        
fakeServer.respondWith('POST', /persons\/?$/, function (xhr, id) { 
  console.info('FAKESERVER: Received POST: ' + xhr.url);
  var body = JSON.parse(xhr.requestBody);
  body.id = sequence++;
  fakeServerObjects.push(body);
  respondJSON(xhr, body); 
});
fakeServer.respondWith('PUT', /persons\/[0-9]/, function (xhr, id) { 
  console.info('FAKESERVER: Received PUT: ' + xhr.url);
  var obj = getObjFromUrl(xhr);
  if (obj) {
    var body = JSON.parse(xhr.requestBody);
    body.id = obj.id; // keep id
    fakeServerObjects[fakeServerObjects.indexOf(obj)] = body; 
    respondJSON(xhr, body);
  } else respondError(xhr);
});
fakeServer.respondWith('DELETE', /persons\/[0-9]/, function (xhr, id) { 
  console.info('FAKESERVER: Received DELETE: ' + xhr.url);
  var obj = getObjFromUrl(xhr);
  if (obj) {
    fakeServerObjects.splice(fakeServerObjects.indexOf(obj), 1);  
    respondJSON(xhr, {});
  } else respondError(xhr);  
});
// *********** FAKE SERVER END *****************
  
})();