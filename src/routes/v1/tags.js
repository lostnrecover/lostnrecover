const SCHEMA = {
    body: {
        type: 'object',
        properties: {
            name: {
                type: 'string'
            }
            
        }
    }
}

module.exports = function(fastify, opts, done) {
    fastify.post('/', (req, res) => {
        // create a new tag
    })
    done();
}