export async function errorHandler(error, request, reply) {
	let e = {
        code: 500,
        originalError: error
    };
	request.log.error({error: error, msg: "Original Error"});
	if(typeof error == 'string') {
		e.code = 500;
		e.details = error;
	} else if (!error) {
		e.code = 500;
		e.details = JSON.stringify(error);
	} else if (typeof error == 'object') {
        e = {...error, ...e};
    }
	if(!e.details && error.message) {
		e.details = error.message
	}
  	// this IS called
    if(e.code && e.code > 399 && e.code < 600) {
        reply.code(e.code)
    } else {
        reply.code(500);
    }
	// if HTML
	if(e.redirect) {
		reply.redirect(e.redirect)
	} else if (e.view) {
		reply.view(e.view, { url: request.url, ...e.data } );
	} else {
		reply.view('error', {title: 'Unexpected Error', error: e, ...e.data})
	}
	// TODO JSON API compliant errors 
	// if json
	// reply.send(error)
	return reply;
}