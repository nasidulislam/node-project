var cluster;

cluster = require('cluster');

function startWorker() {
    var worker = cluster.fork();
    console.log('CLUSTER: worker %d started', worker.id);
}

if(cluster.isMaster) {
    require('os').cpus().forEach(function() {
        startWorker();
    });

    /* log any worker that disconnects
        if disconnected, then wait for next worker to spawn
        and replace it
    */

    // log information about worker that disconnected
    cluster.on('disconnect', function(worker) {
        console.log('CLUSTER: worker %d disconnected from cluster.', worker.id);
    });

    // create new worker to replace the one that disconnected
    cluster.on('exit', function(worker, code, signal) {
        console.log('CLUSTER: worker %d disconnected with exit code %d (%s)', worker.id, code, signal);
        startWorker();
    });
} else {
    // start app on worker
    require('./meadowlark.js');
}
