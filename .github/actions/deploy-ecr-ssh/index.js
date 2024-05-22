const core = require("@actions/core");
const github = require("@actions/github");
const fs = require("fs");
const { exec } = require("child_process");

const DEPLOY_SCRIPT_PATH = "./deploy.sh";

function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stderr });
        return;
      }
      resolve(stdout);
    });
  });
}

(async () => {
  try {
    const [privateKey, remoteServer, remoteUser, sshPort] = [
      core.getInput("ssh-private-key"),
      core.getInput("ssh-server"),
      core.getInput("ssh-user"),
      core.getInput("ssh-port"),
    ];
    const [awsAccessKeyId, awsSecretAccessKey, awsRegion, ecrRepo] = [
      core.getInput("aws-access-key-id"),
      core.getInput("aws-secret-access-key"),
      core.getInput("aws-region"),
      core.getInput("ecr-repo"),
    ];
    const [appName, tag, port, envVars] = [
      core.getInput("app-name"),
      core.getInput("image-tag"),
      core.getInput("port"),
      core.getInput("env"),
    ];

    const params = {
      target: remoteServer,
      app_name: appName,
      user: remoteUser,
      server: remoteServer,
      aws_default_region: awsRegion,
      aws_ecr: ecrRepo,
      app_env: "production",
      image_tag: tag,
      port: port,
    };

    const privateKeyPath = "./id_rsa";
    fs.writeFileSync(privateKeyPath, privateKey);
    fs.chmodSync(privateKeyPath, "400");

    const sshScript = `
    ssh -o StrictHostKeyChecking=no ${params.user}@${params.server} <<EOF
      aws ecr get-login-password \
        --region ${params.aws_default_region} | docker login --username AWS \
        --password-stdin ${params.aws_ecr}
      chmod +x -R /tmp/deploy_${params.app_name}.sh
      echo '${params.app_env}' > /tmp/.env.${params.app_name}
      sh /tmp/deploy_${params.app_name}.sh ${params.app_name} \
        "${params.aws_ecr}/${params.app_name}:${params.image_tag}" ${params.port}
    EOF
    `;
    const deployScript = `#!/bin/bash
    CONTAINER_NAME=${params.app_name}
    IMAGE=${params.aws_ecr}/${params.app_name}:${params.image_tag}
    PORT=${params.port}
    NETWORK=bridge

    drop_old() {
        echo "📝 Checking if a container named '$CONTAINER_NAME' exists..."

        if [ ! "$(docker container ls -q -f name=$CONTAINER_NAME)" ]; then
            if [ "$(docker container ls -aq -f status=exited -f name=$CONTAINER_NAME)" ]; then
                echo "📍 $CONTAINER_NAME has status 'exited', deleting..."
                docker container rm $CONTAINER_NAME
            fi
        else
            echo "📍 $CONTAINER_NAME found and running, deleting..."
            docker container rm $(docker container stop $CONTAINER_NAME)
        fi
    }

    update_app() {
        echo "🚀 Updating $CONTAINER_NAME..."
        docker pull $IMAGE
        docker container run --name $CONTAINER_NAME -p $PORT:3000 \
            -e HOST="0.0.0.0" --restart unless-stopped \
            --network $NETWORK -d \
            --env-file /tmp/.env.$CONTAINER_NAME $IMAGE
    }

    clean_docker() {
        echo "♻️ Cleanning..."
        docker container prune -f
        docker image prune -f
    }

    echo "🚧 Deploying $CONTAINER_NAME"
    drop_old 
    update_app
    clean_docker
    echo "✅ $CONTAINER_NAME deployed successfully!"
    `;
    fs.writeFileSync(DEPLOY_SCRIPT_PATH, deployScript);
    fs.chmodSync(DEPLOY_SCRIPT_PATH, "700");

    // Create .env file
    fs.writeFileSync(`.env.${appName}`, envVars);

    // Upload .env file to remote server
    await runCommand(
      `scp -o StrictHostKeyChecking=no -P ${sshPort} .env.${appName} ${remoteUser}@${remoteServer}:/tmp/.env.${appName}`
    );

    await runCommand(
      `ssh -o StrictHostKeyChecking=no -p ${sshPort} ${remoteUser}@${remoteServer} 'bash -s' < ${DEPLOY_SCRIPT_PATH}`,
    );

    core.setOutput("status", "success");
  } catch (error) {
    core.setFailed(error.message);
  }
})();
