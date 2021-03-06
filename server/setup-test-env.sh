#!/bin/bash

_volume_path=/home/bitergia/fiware-devguide-app
pushd $( dirname $0 ) > /dev/null
_local_path=$( dirname $(pwd) )
popd > /dev/null
cd ${_local_path}

_compose_path="docker/compose"
_yml="${_compose_path}/docker-compose.yml"

function start_test_env() {

    local _max_tries=60
    local _started=0
    local _tries=0
    local ret=0

    # setup compose.yml to enable volume on devguide if not enabled
    sed -i "${_yml}" \
        -e "/^devguide:/,$ s|.*:${_volume_path}|        - ${_local_path}:${_volume_path}|" \
        -e "s|#[ ]*volumes:|volumes:|"

    # start containers with docker-compose
    docker-compose -f "${_yml}" -p tests up -d

    # wait for devguide to be ready
    container_name=$( docker-compose -f "${_yml}" -p tests ps 2>/dev/null | grep _devguide_ | cut -d ' ' -f 1 )
    echo "Waiting for devguide to be ready."
    while [ ${_started} -eq 0 -a ${_tries} -lt ${_max_tries} ]; do
        if ( docker logs ${container_name} | grep -qE "service apache2 reload" ) ; then
            _started=1
        else
            _tries=$(( ${_tries} + 1 ))
        fi
        sleep 1
    done

    if [ ${_started} -eq 0 ]; then
        echo "Test environment not ready.  Aborting."
        ${0} stop
        ret=1
    else
        echo "Test environment ready."
        ret=0
    fi

    exit ${ret}
}

function stop_test_env() {
    # stop and remove containers
    docker-compose -f "${_yml}" -p tests kill
    docker-compose -f "${_yml}" -p tests rm -f -v
    # restore configuration files
    git checkout "${_yml}"
    git checkout "server/config.js"
    exit 0
}

case "${1}" in
    start)
        start_test_env
        ;;
    stop)
        stop_test_env
        ;;
    *)
        echo "Unknown command '${1}'"
        exit 1
        ;;
esac
