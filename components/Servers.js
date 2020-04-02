import React from "react";

const Servers = ({ servers }) => {
    return (
        <div className={"row d-flex align-items-center justify-content-center"}>
            {servers.map((server, i) => (
                <div className={"server-card"} key={i} onClick={() => window.open(server.vanity, "_blank")}>
                    <img className={"server-splash"} src={`${server.splash}`} />
                    <div className={"server-shadow"}></div>
                    <img className={"server-icon"} src={`${server.icon}`} />
                    <img className={"server-badge"} src={`${server.badge}`} />
                    <div className={"server-name"}>{server.name}</div>
                    <div className={"server-member-count"}>
                        <div className={"server-online-text"} id={`${server.id}-online`}>
                            {server.online}&nbsp;Online
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Servers;
