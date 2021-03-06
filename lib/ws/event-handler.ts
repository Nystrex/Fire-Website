import { WebsiteEvents } from "../interfaces/aether";
import { MessageUtil } from "./message-util";
import { EventEmitter } from "events";
import { Message } from "./message";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class EventHandler {
  identified: "identifying" | boolean;
  heartbeat?: NodeJS.Timeout;
  websocket?: WebSocket;
  emitter: EventEmitter;
  subscribed: string;
  session?: string;
  queue: Message[];
  acked?: boolean;
  seq?: number;

  constructor(emitter: EventEmitter) {
    this.identified = false;
    this.emitter = emitter;
    this.subscribed =
      typeof window != "undefined" ? window.location.pathname : "/";
    this.queue = [];
  }

  setWebsocket(websocket: WebSocket, reconnect?: boolean) {
    if (this.websocket) {
      this.websocket.close(1000, "Reconnecting");
      delete this.websocket;
    }
    this.websocket = websocket;
    this.websocket.onmessage = (message) => {
      const decoded = MessageUtil.decode(message.data);
      if (!decoded)
        return console.error(
          "%c WS %c Failed to decode message! ",
          "background: #C95D63; color: white; border-radius: 3px 0 0 3px;",
          "background: #353A47; color: white; border-radius: 0 3px 3px 0",
          { data: message.data }
        );
      if (typeof decoded.s == "number") this.seq = decoded.s;
      // heartbeats acks can be spammy and have a null body anyways
      if (decoded.op != WebsiteEvents.HEARTBEAT_ACK)
        console.debug(
          `%c WS %c Incoming %c ${WebsiteEvents[decoded.op]} `,
          "background: #279AF1; color: white; border-radius: 3px 0 0 3px;",
          "background: #9CFC97; color: black; border-radius: 0 3px 3px 0",
          "background: #353A47; color: white; border-radius: 0 3px 3px 0",
          decoded
        );
      this.emitter.emit(WebsiteEvents[decoded.op], decoded.d);
      if (WebsiteEvents[decoded.op] in this)
        this[WebsiteEvents[decoded.op]](decoded.d);
    };
    this.websocket.onopen = () => {
      reconnect &&
        this.emitter.emit("NOTIFICATION", {
          text: "Websocket connected",
          severity: "success",
          horizontal: "right",
          vertical: "top",
          autoHideDuration: 3000,
        });
      console.info(
        `%c WS %c Websocket connected! `,
        "background: #9CFC97; color: black; border-radius: 3px 0 0 3px;",
        "background: #353A47; color: white; border-radius: 0 3px 3px 0",
        this.websocket
      );
      this.identify();
      while (this.queue?.length) this.send(this.queue.pop());
    };
    this.websocket.onclose = (event) => {
      console.error(
        `%c WS %c Websocket closed! `,
        "background: #C95D63; color: white; border-radius: 3px 0 0 3px;",
        "background: #353A47; color: white; border-radius: 0 3px 3px 0",
        event
      );
      if (event.code == 4015)
        this.emitter.emit("NOTIFICATION", {
          text: "Connected to websocket in another session",
          severity: "error",
          horizontal: "right",
          vertical: "top",
          autoHideDuration: 15000,
        });
      else if (event.code == 4016)
        this.emitter.emit("NOTIFICATION", {
          text: "Connected to websocket from another location",
          severity: "error",
          horizontal: "right",
          vertical: "top",
          autoHideDuration: 15000,
        });
      else if (event.code == 4005) {
        this.emitter.emit("NOTIFICATION", {
          text: "Invalid Session",
          severity: "error",
          horizontal: "right",
          vertical: "top",
          autoHideDuration: 5000,
        });
        delete this.seq;
      } else
        this.emitter.emit("NOTIFICATION", {
          text: "Websocket error occurred",
          severity: "error",
          horizontal: "right",
          vertical: "top",
          autoHideDuration: 5000,
        });
      this.identified = false;
      // cannot recover from codes below
      if (
        event.code == 1013 ||
        event.code == 1008 ||
        event.code == 4001 ||
        event.code == 4015 ||
        event.code == 4016
      )
        return;
      try {
        sleep(2500).then(() => {
          console.info(
            "%c WS %c Reconnecting... ",
            "background: #9CFC97; color: black; border-radius: 3px 0 0 3px;",
            "background: #353A47; color: white; border-radius: 0 3px 3px 0"
          );
          const ws = new WebSocket(
            "wss://aether-ws.gaminggeek.dev/website?encoding=zlib"
          );
          return this.setWebsocket(ws, true);
        });
      } catch {
        console.error(
          "%c WS %c Websocket failed to reconnect! ",
          "background: #C95D63; color: white; border-radius: 3px 0 0 3px;",
          "background: #353A47; color: white; border-radius: 0 3px 3px 0"
        );
      }
    };
    if (this.websocket.readyState == this.websocket.CLOSED)
      this.websocket.onclose(
        new CloseEvent("unknown", {
          code: 0,
          reason: "unknown",
          wasClean: false,
        })
      );
    return this;
  }

  handleSubscribe(route: string, extra?: unknown) {
    if (route == this.subscribed && !extra) return;
    this.send(new Message(WebsiteEvents.SUBSCRIBE, { route, extra }));
    this.subscribed = route;
  }

  HELLO(data: { sessionId: string; interval: number }) {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => {
      if (this.acked == false)
        return this.websocket?.close(4004, "Did not receive heartbeat ack");
      this.acked = false;
      this.send(new Message(WebsiteEvents.HEARTBEAT, this.seq || null));
    }, data.interval);
    this.session = data.sessionId;
  }

  HEARTBEAT_ACK() {
    this.acked = true;
  }

  identify() {
    if (this.identified) return;
    this.identified = "identifying";
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      delete this.heartbeat;
    }
    this.send(
      new Message(WebsiteEvents.IDENTIFY_CLIENT, {
        config: { subscribed: this.subscribed ?? window.location.pathname },
        env: process.env.NODE_ENV,
        sessionId: this.session,
        seq: this.seq,
      })
    );
    this.identified = true;
    setTimeout(() => {
      if (
        !this.heartbeat &&
        this.websocket &&
        this.websocket.readyState == this.websocket.OPEN
      )
        this.websocket.close(4004, "Did not receive HELLO");
    }, 2000);
  }

  devToolsWarning() {
    console.log(
      `%c STOP!

%cUNLESS YOU KNOW WHAT YOU'RE DOING, DO NOT COPY/PASTE ANYTHING IN HERE!
DOING SO COULD REVEAL SENSITIVE INFORMATION SUCH AS YOUR EMAIL OR ACCESS TOKEN

IT'S BEST TO JUST CLOSE THIS WINDOW AND PRETEND IT DOES NOT EXIST.`,
      "background: #C95D63; color: white; font-size: xxx-large; border-radius: 8px 8px 8px 8px;",
      "background: #353A47; color: white; font-size: medium; border-radius: 0 0 0 0"
    );
  }

  private send(message?: Message) {
    if (
      !message ||
      !this.websocket ||
      this.websocket.readyState != this.websocket.OPEN
    )
      return message && this.queue.push(message);
    if (process.env.NODE_ENV == "development")
      (globalThis as { [key: string]: unknown }).eventHandler = this;
    // heartbeats can be spammy and just have the sequence anyways
    if (message.type != WebsiteEvents.HEARTBEAT)
      console.debug(
        `%c WS %c Outgoing %c ${WebsiteEvents[message.type]} `,
        "background: #279AF1; color: white; border-radius: 3px 0 0 3px;",
        "background: #9CFC97; color: black; border-radius: 0 3px 3px 0",
        "background: #353A47; color: white; border-radius: 0 3px 3px 0",
        message.data
      );
    if (this.identified == false) this.identify();
    this.websocket.send(MessageUtil.encode(message));
  }
}
