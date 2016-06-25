// TODO solve cors
var gse = (() => {
    const ConnectPType = 0;
    const Disconnect = 1;
    const EventPType = 2;
    const AckPType = 3;
    const ErrorPType = 4;

    class Connection {

        constructor(url) {
            this._url = url;
            this._ws = null;
            this._open = false;
            this._namespaces = new Map();
            this._namespaces.set("/", new Namespace(this, "/"));
            this._nqueue = [];
            this._squeue = [];
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
                    this._nqueue.push(
                        namespace
                    );
                }
            }
            return namespace;
        }

        emit(namespace, event, data, id) {
            let message =  {
                name: event,
                data: data,
                endpoint: namespace.name
            };

            if(id) {
                message.id = id;
                message.type = AckPType;
            } else {
                message.type = EventPType;
            }

            let strMessage = JSON.stringify(message);

            if(this._open && namespace.connected) {
                this._ws.send(strMessage);
            } else {
                this._squeue.push(strMessage);
            }
        }

        connectCallback() {
            for(var namespace of this._nqueue) {
                this._connectNamespace(namespace);
            }
            this._nqueue = [];

            for(var message of this._squeue) {
                this._ws.send(message);
            }
            this._squeue = [];
        }

        _connectNamespace(namespace) {
            this.ws.send(
                JSON.stringify(
                    {
                        type: ConnectPType,
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
            this._ackCallbacks = new Map();
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

        emit(event, data, ackCallback) {
            let uuid;
            if(ackCallback) {
                uuid = Namespace.generatedUUID();
                this._ackCallbacks.set(uuid, ackCallback);
            }

            this._connection.emit(this, event, data, uuid);
        }

        getAckCallback(id) {
            return this._ackCallbacks.get(id);
        }

        getEventListeners(event) {
            return this._eventListeners.get(event);
        }

        // TODO make more complex
        static generatedUUID() {
            return new Date().getTime();
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
                if(!packet) {
                    return;
                }
            } catch(e) {
                return;
            }

            let namespace = connection.namespaces.get(packet.endpoint);
            if(!namespace) {
                return;
            }

            switch(packet.type) {
                case ConnectPType:
                    onConnect(namespace);
                    break;
                case Disconnect:
                    onDisconnect(namespace);
                    break;
                case EventPType:
                    onEvent(namespace, packet);
                    break;
                case AckPType:
                    onAck(namespace, packet);
                    break;
                case ErrorPType:
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

        function onAck(namespace, packet) {
            let callback = namespace.getAckCallback(packet.id);
            if(callback) {
                callback(packet.data);
            }
        }
    }

    // map of all current connections
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