const Connect = 0;
const Disconnect = 1;
const Event = 2;
const Ack = 3;
const Error = 4;

class Connection {

    constructor(url) {
        this._url = url;
        this._ws = null;
        this._open = false;
        this._namespaces = new Map();
        this._namespaces.set("/", new Namespace(this, "/"));
        this._queue = [];
    }

    root() {
        return this._namespaces.get("/");
    }

    connect() {
        this._ws = new WebSocket(this.url);
    }

    createNamespace(namespaceName) {
        let namespace = this._namespaces.get(namespaceName);
        if(!namespace) {
            namespace = new Namespace(this, namespaceName);
            this._namespaces.set(namespaceName, namespace);
            if(this._open) {
                this._connectNamespace(namespace)
            } else {
                this._queue.push(
                    namespace
                );
            }
        }
        return namespace;
    }

    emit(namespace, event, data) {
        if(this._open && namespace.connected) {
            this._ws.send(
                JSON.stringify(
                    {
                        type: Event,
                        name: event,
                        data: data,
                        endpoint: namespace.name
                    }
                )
            );
        }
    }

    connectCallback() {
        for(var namespace of this._queue) {
            this._connectNamespace(namespace);
        }

        this._queue = [];
    }

    _connectNamespace(namespace) {
        this.ws.send(
            JSON.stringify(
                {
                    type: Connect,
                    endpoint: namespace.name
                }
            )
        );
    }

    get url() {
        return this._url;
    }

    get ws() {
        return this._ws;
    }

    set open(open) {
       this._open = open;
    }

    get open() {
        return this._open;
    }

    get namespaces() {
        return this._namespaces;
    }
}

class Namespace {
    constructor(connection, namespaceName) {
        this._connection = connection;
        this._name = namespaceName;
        this._connected = false;

        // callbacks
        this._cCallbacks = [];
        this._dCallbacks = [];
        this._eventListeners = new Map();
    }

    onConnect(callback) {
        this._cCallbacks.push(callback);
    }

    onDisconnect(callback) {
        this._dCallbacks.push(callback);
    }

    listen(event, callback) {
        let listeners = this._eventListeners.get(event);
        if(!listeners) {
            listeners = [];
            this._eventListeners.set(event, listeners);
        }
        listeners.push(callback);
    }

    emit(event, data) {
        this._connection.emit(this, event, data);
    }

    getEventListeners(event) {
        return this._eventListeners.get(event);
    }

    get connected() {
        return this._connected;
    }

    set connected(connected) {
        this._connected = connected;
    }

    get name() {
        return this._name;
    }

    get cCallbacks() {
        return this._cCallbacks;
    }

    get dCallbacks() {
        return this._dCallbacks;
    }
}

function wrapConnection(connection) {
    connection.ws.onopen = onOpen;
    connection.ws.onclose = onClose;
    connection.ws.onmessage = onMessage;

    function onOpen() {
        connection.open = true;
        connection.root().connected = true;
        connection.connectCallback();
        onConnect(connection.root());
    }

    function onClose() {
        connection.open = false;
        connection.root().connected = false;
        onDisconnect(connection.root());
    }

    function onMessage(msgEvt) {
        if(!msgEvt.data) {
            return
        }

        let packet;

        try {
            packet = JSON.parse(msgEvt.data);
        } catch(e) {
            return;
        }

        let namespace = connection.namespaces.get(packet.endpoint);
        if(!namespace) {
            return;
        }

        switch(packet.type) {
            case Connect:
                onConnect(namespace);
                break;
            case Disconnect:
                onDisconnect(namespace);
                break;
            case Event:
                onEvent(namespace, packet);
                break;
            // TODO implement in the future
            case Ack:
                break;
            case Error:
                break;
        }
    }

    function onConnect(namespace) {
        namespace.connected = true;

        for(var callback of namespace.cCallbacks) {
            callback();
        }
    }

    function onDisconnect(namespace) {
        namespace.connected = false;

        for(var callback of namespace.dCallbacks) {
            callback();
        }
    }

    function onEvent(namespace, packet) {
        let listeners = namespace.getEventListeners(packet.name);
        if(!listeners) {
            return;
        }
        for(var callback of listeners) {
            callback(packet.data);
        }
    }
}

// TODO solve problem with
var gse = (() => {
    var connections = new Map();

    return {
        connect: function(conf) {
            if(!conf.baseUrl) {
                return;
            }

            let connection = connections.get(conf.baseUrl);
            if(!connection) {
                connection = new Connection(conf.baseUrl);
                connection.connect();
                wrapConnection(connection);
                connections.set(conf.baseUrl, connection);
            }

            if(!conf.namespace || conf.namespace === "/") {
                return connection.root();
            }

            let namespace = connections.get(conf.namespace);
            if(!namespace) {
                return connection.createNamespace(conf.namespace);
            }
        }
    };
})();