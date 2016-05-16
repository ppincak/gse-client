"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// TODO solve cors
var gse = function () {
    var ConnectPType = 0;
    var Disconnect = 1;
    var EventPType = 2;
    var AckPType = 3;
    var ErrorPType = 4;

    var Connection = function () {
        function Connection(url) {
            _classCallCheck(this, Connection);

            this._url = url;
            this._ws = null;
            this._open = false;
            this._namespaces = new Map();
            this._namespaces.set("/", new Namespace(this, "/"));
            this._nqueue = [];
            this._squeue = [];
        }

        _createClass(Connection, [{
            key: "root",
            value: function root() {
                return this._namespaces.get("/");
            }
        }, {
            key: "connect",
            value: function connect() {
                this._ws = new WebSocket(this.url);
            }
        }, {
            key: "createNamespace",
            value: function createNamespace(namespaceName) {
                var namespace = this._namespaces.get(namespaceName);
                if (!namespace) {
                    namespace = new Namespace(this, namespaceName);
                    this._namespaces.set(namespaceName, namespace);
                    if (this._open) {
                        this._connectNamespace(namespace);
                    } else {
                        this._nqueue.push(namespace);
                    }
                }
                return namespace;
            }
        }, {
            key: "emit",
            value: function emit(namespace, event, data, id) {
                var message = {
                    type: EventPType,
                    name: event,
                    data: data,
                    endpoint: namespace.name
                };

                if (id) {
                    message.id = id;
                }

                var strMessage = JSON.stringify(message);

                if (this._open && namespace.connected) {
                    this._ws.send(strMessage);
                } else {
                    this._squeue.push(strMessage);
                }
            }
        }, {
            key: "connectCallback",
            value: function connectCallback() {
                var _iteratorNormalCompletion = true;
                var _didIteratorError = false;
                var _iteratorError = undefined;

                try {
                    for (var _iterator = this._nqueue[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                        var namespace = _step.value;

                        this._connectNamespace(namespace);
                    }
                } catch (err) {
                    _didIteratorError = true;
                    _iteratorError = err;
                } finally {
                    try {
                        if (!_iteratorNormalCompletion && _iterator.return) {
                            _iterator.return();
                        }
                    } finally {
                        if (_didIteratorError) {
                            throw _iteratorError;
                        }
                    }
                }

                this._nqueue = [];

                var _iteratorNormalCompletion2 = true;
                var _didIteratorError2 = false;
                var _iteratorError2 = undefined;

                try {
                    for (var _iterator2 = this._squeue[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                        var message = _step2.value;

                        this._ws.send(message);
                    }
                } catch (err) {
                    _didIteratorError2 = true;
                    _iteratorError2 = err;
                } finally {
                    try {
                        if (!_iteratorNormalCompletion2 && _iterator2.return) {
                            _iterator2.return();
                        }
                    } finally {
                        if (_didIteratorError2) {
                            throw _iteratorError2;
                        }
                    }
                }

                this._squeue = [];
            }
        }, {
            key: "_connectNamespace",
            value: function _connectNamespace(namespace) {
                this.ws.send(JSON.stringify({
                    type: ConnectPType,
                    endpoint: namespace.name
                }));
            }
        }, {
            key: "url",
            get: function get() {
                return this._url;
            }
        }, {
            key: "ws",
            get: function get() {
                return this._ws;
            }
        }, {
            key: "open",
            set: function set(open) {
                this._open = open;
            },
            get: function get() {
                return this._open;
            }
        }, {
            key: "namespaces",
            get: function get() {
                return this._namespaces;
            }
        }]);

        return Connection;
    }();

    var Namespace = function () {
        function Namespace(connection, namespaceName) {
            _classCallCheck(this, Namespace);

            this._connection = connection;
            this._name = namespaceName;
            this._connected = false;

            // callbacks
            this._cCallbacks = [];
            this._dCallbacks = [];
            this._eventListeners = new Map();
            this._ackCallbacks = new Map();
        }

        _createClass(Namespace, [{
            key: "onConnect",
            value: function onConnect(callback) {
                this._cCallbacks.push(callback);
            }
        }, {
            key: "onDisconnect",
            value: function onDisconnect(callback) {
                this._dCallbacks.push(callback);
            }
        }, {
            key: "listen",
            value: function listen(event, callback) {
                var listeners = this._eventListeners.get(event);
                if (!listeners) {
                    listeners = [];
                    this._eventListeners.set(event, listeners);
                }
                listeners.push(callback);
            }
        }, {
            key: "emit",
            value: function emit(event, data, ackCallback) {
                var uuid = void 0;
                if (ackCallback) {
                    uuid = Namespace.generatedUUID();
                    this._ackCallbacks.set(uuid, ackCallback);
                }

                this._connection.emit(this, event, data, uuid);
            }
        }, {
            key: "getAckCallback",
            value: function getAckCallback(id) {
                return this._ackCallbacks.get(id);
            }
        }, {
            key: "getEventListeners",
            value: function getEventListeners(event) {
                return this._eventListeners.get(event);
            }

            // TODO make more complex

        }, {
            key: "connected",
            get: function get() {
                return this._connected;
            },
            set: function set(connected) {
                this._connected = connected;
            }
        }, {
            key: "name",
            get: function get() {
                return this._name;
            }
        }, {
            key: "cCallbacks",
            get: function get() {
                return this._cCallbacks;
            }
        }, {
            key: "dCallbacks",
            get: function get() {
                return this._dCallbacks;
            }
        }], [{
            key: "generatedUUID",
            value: function generatedUUID() {
                return new Date().getTime();
            }
        }]);

        return Namespace;
    }();

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
            if (!msgEvt.data) {
                return;
            }

            var packet = void 0;

            try {
                packet = JSON.parse(msgEvt.data);
            } catch (e) {
                return;
            }

            var namespace = connection.namespaces.get(packet.endpoint);
            if (!namespace) {
                return;
            }

            switch (packet.type) {
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
                // TODO implement in the future
                case ErrorPType:
                    break;
            }
        }

        function onConnect(namespace) {
            namespace.connected = true;

            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;
            var _iteratorError3 = undefined;

            try {
                for (var _iterator3 = namespace.cCallbacks[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                    var callback = _step3.value;

                    callback();
                }
            } catch (err) {
                _didIteratorError3 = true;
                _iteratorError3 = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion3 && _iterator3.return) {
                        _iterator3.return();
                    }
                } finally {
                    if (_didIteratorError3) {
                        throw _iteratorError3;
                    }
                }
            }
        }

        function onDisconnect(namespace) {
            namespace.connected = false;

            var _iteratorNormalCompletion4 = true;
            var _didIteratorError4 = false;
            var _iteratorError4 = undefined;

            try {
                for (var _iterator4 = namespace.dCallbacks[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                    var callback = _step4.value;

                    callback();
                }
            } catch (err) {
                _didIteratorError4 = true;
                _iteratorError4 = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion4 && _iterator4.return) {
                        _iterator4.return();
                    }
                } finally {
                    if (_didIteratorError4) {
                        throw _iteratorError4;
                    }
                }
            }
        }

        function onEvent(namespace, packet) {
            var listeners = namespace.getEventListeners(packet.name);
            if (!listeners) {
                return;
            }
            var _iteratorNormalCompletion5 = true;
            var _didIteratorError5 = false;
            var _iteratorError5 = undefined;

            try {
                for (var _iterator5 = listeners[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
                    var callback = _step5.value;

                    callback(packet.data);
                }
            } catch (err) {
                _didIteratorError5 = true;
                _iteratorError5 = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion5 && _iterator5.return) {
                        _iterator5.return();
                    }
                } finally {
                    if (_didIteratorError5) {
                        throw _iteratorError5;
                    }
                }
            }
        }

        function onAck(namespace, packet) {
            var callback = namespace.getAckCallback(packet.id);
            if (callback) {
                callback(packet.data);
            }
        }
    }

    // map of all current connections
    var connections = new Map();

    return {
        connect: function connect(conf) {
            if (!conf.baseUrl) {
                return;
            }

            var connection = connections.get(conf.baseUrl);
            if (!connection) {
                connection = new Connection(conf.baseUrl);
                connection.connect();
                wrapConnection(connection);
                connections.set(conf.baseUrl, connection);
            }

            if (!conf.namespace || conf.namespace === "/") {
                return connection.root();
            }

            var namespace = connections.get(conf.namespace);
            if (!namespace) {
                return connection.createNamespace(conf.namespace);
            }
        }
    };
}();