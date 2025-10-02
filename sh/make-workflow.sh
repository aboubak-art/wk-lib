#!/bin/sh

# This script creates a GitHub Actions workflow file for a project.

# Get options.
# Available options:
# -h, --help: Show help message
# -e, --env: Specify the environment. Possible values: "dev", "stg", "prod"
# -r, --repo: Specify the repository name.
# -b, --branch: Specify the branch name.
# -p, --port: Specify the port number.
get_options() {
    while [ $# -gt 0 ]; do
        case "$1" in
        -h | --help)
            echo "Usage: $0 [options] /path/to/project"
            echo "Options:"
            echo "  -h, --help       Show this help message"
            echo "  -e, --env        Specify the environment."
            echo "  -r, --repo       Specify the repository name."
            echo "  -b, --branch     Specify the branch name."
            exit 0
            ;;
        -e | --env)
            ENV="$2"
            shift
            ;;
        -r | --repo)
            REPO="$2"
            shift
            ;;
        -b | --branch)
            BRANCH="$2"
            shift
            ;;
        *)
            if [ -z "$PROJECT_PATH" ]; then
                PROJECT_PATH="$1"
            else
                echo "Error: Unknown option $1"
                exit 1
            fi
            ;;
        esac
        shift
    done
}

# Check if the required arguments are provided
check_args() {
    if [ -z "$ENV" ]; then
        echo "Error: Environment is required."
        exit 1
    fi

    if [ "$ENV" != "dev" ] && [ "$ENV" != "stg" ] && [ "$ENV" != "prod" ]; then
        echo "Error: Invalid environment. Possible values: dev, stg, prod"
        exit 1
    fi

    if [ -z "$REPO" ]; then
        echo "Error: Repository name is required."
        exit 1
    fi

    if [ -z "$BRANCH" ]; then
        echo "Error: Branch name is required."
        exit 1
    fi

    if [ -z "$PROJECT_PATH" ]; then
        echo "Error: Project path is required."
        exit 1
    fi
}
