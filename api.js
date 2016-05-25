const https=require('https');
const EventEmitter = require('events');
const util = require('util');
const querystring =require('querystring');
const urlapi=require('url');
function TelegramInterface(token)
{
    EventEmitter.call(this);
    this._token = token;
    this._lastupdate =0-1;
}
util.inherits(TelegramInterface, EventEmitter);
var pt = TelegramInterface.prototype;
pt.set_last_update=function(new_update)
{
    var that=this;
    if(new_update<0)
	that._lastupdate = -1;
    else
	that._lastupdate = Math.max(that._lastupdate,new_update);
}
pt.matrify=function(item)
{
  var item_row = Math.trunc(Math.sqrt(item.length))
  var matrix=[]
  var row=[]
  for(var i = 0; i < item.length;i++)
  {
    row.push(item[i]);
    if( row.length== item_row)
    {
	matrix.push(row)
      row=[]
    }
  }
  if(row.length > 0)
      matrix.push(row)
  return matrix;
}
pt.send_choice=function(chat_id,text,alternatives)
{
    var that = this;
    that.send_message(chat_id,text,JSON.stringify({'inline_keyboard':that.matrify(alternatives.map((x)=>{return {'text':x,'callback_data':x};}))}));
}
pt.send_message=function(chat_id,text,reply_markup)
{
    var data = {'chat_id':chat_id,'text':text,'parse_mode':'Markdown'};
    if(reply_markup)
	data.reply_markup=reply_markup;
    else
	data.reply_markup  = JSON.stringify({'hide_keyboard':true});
    this.post('sendMessage',data ,(e,d)=>{
	if(e)
	{
	    this.emit('error',e);
	}
	this.emit('message-sent',chat_id,text);
	});
}
pt.get_request_url=function(method_name)
{
    return `https://api.telegram.org/bot${this._token}/${method_name}`;
}
pt.is_command=function(text)
{
    if(text)
    {
	if(text !=="")
	{
	    return text[0] ==="/";
	}
    }
    return false;
}
pt.process_message=function(update_id,message)
{
    var date= new Date(message.date * 1000);
    var chat_id = message.chat.id;
    var text = message.text;
    if(this.is_command(text))
    {
	var pieces=text.split(/\s+/);
	var command=pieces[0].substring(1);
	pieces.splice(0,1);
	var args = pieces;
	var eventName=`command-${command}`;
	if(this.listenerCount(eventName)> 0)
	{
	    this.emit(eventName,chat_id,date,message.from,args);
	}
	else
	{
	    this.emit('command-unknow',chat_id,date,message.from,command);
	}
    }
    else
    {
	this.emit('message',chat_id,date,message.from,message.text);
    }
}
pt.process_update=function(update)
{
    var id = update.update_id;
    if(update.message)
    {
	this.process_message(id,update.message);
    }
    else if(update.callback_query)
    {
	var chat_id = update.callback_query.message.chat.id;
	var data = update.callback_query.data;
	this.send_message(chat_id,"YOU CHOOSE: "+data,null);
    }
    this.set_last_update(id);
}
pt.process_updates=function(error,data)
{
    
    var that=this;
    if(error)
    {
	this.emit('error',error);
	return;
    }
    if(!data.ok)
    {
	this.emit('error',data.description);
	return;
    }
    data.result.forEach((e)=>{
	that.process_update(e);
    });
}
pt.get_updates=function(callback,timeout){
    this.get('getUpdates',{'offset':this._lastupdate+1,'timeout':timeout} ,callback);
}
pt.updates_loop=function(timeout){
    var that = this;
    that.get_updates(function(e,data){
	that.process_updates(e,data);
	that.updates_loop(timeout);
	return;
    },timeout);
}
pt.post=function(method,arg,callback)
{
    var that=this;
    if(!callback)
	callback=that.process_updates.bind(this);
    var url = this.get_request_url(method);
    var parsed = urlapi.parse(url)
    
    var post_options = {
	host: parsed.host,
	port: '443',
	path: parsed.path,
	method: 'POST',
	headers: {
            'Content-Type': 'application/json'
	}
     };

    var req = https.request(post_options,(res)=>{
	var data="";
	
	res.on('data', (chunk) => {
	    data = data +chunk;
	});
	res.on('end', () => {
	    console.log(data);
	    e=null;
	    try
	    {
		data = JSON.parse(data);
		if(!data.ok)
		    console.log("ERROR: "+JSON.stringify(data));
	    }
	    catch(ex)
	    {
		e=ex;
	    }
	    if(callback)
		callback(e,data);
	})
    });
    req.write(JSON.stringify(arg));
    console.log(JSON.stringify(arg));
    req.on('error', (e) => {
	callback(e,null);
    });
    req.end();
}
pt.get=function(method,arg,callback)
{
    var that=this;
    if(!callback)
	callback=that.process_updates.bind(this);
    var url = this.get_request_url(method);
    if(arg)
    {
	url = url+'?'+querystring.stringify(arg);
    }
    console.log("URL: "+url);
    var req = https.request(url,(res)=>{
	var data="";
	
	res.on('data', (chunk) => {
	    data = data +chunk;
	});
	res.on('end', () => {
	    e=null;
	    try
	    {
		data = JSON.parse(data);
	    }
	    catch(ex)
	    {
		e=ex;
	    }
	    if(callback)
		callback(e,data);
	})
    });
    req.on('error', (e) => {
	callback(e,null);
    });
    req.end();
}
module.exports=function(token)
{
    return new TelegramInterface(token);
}
