const core = require("@actions/core")
const { DefaultArtifactClient } = require("@actions/artifact")
const fs = require("fs")
const path = require("path")

const FILE_NAME = "matrixtest.lock"
const ARTIFACT_NAME = "matrixlocktest"

async function run() {
	try {
		const artifactClient = new DefaultArtifactClient()
		const workspace = process.env.GITHUB_WORKSPACE
		const fullPath = path.join(workspace, FILE_NAME)

		const step = core.getInput("step", { required: true })
		switch (step) {
			case "init":
				{
					const order = core.getInput("order", { required: true })

					fs.writeFileSync(fullPath, order)

					const uploadResponse = await artifactClient.uploadArtifact(
						ARTIFACT_NAME,
						[fullPath],
						workspace,
						{ continueOnError: false }
					)

					core.info("Matrix lock initialized")
				}
				break
			case "wait":
				{
					core.info("Waiting for lock")
					const id = core.getInput("id", { required: true })
					const retryCount = core.getInput("retry-count")
					const retryDelay = core.getInput("retry-delay")

					const matrixLockArtifact = await artifactClient.getArtifact(
						ARTIFACT_NAME
					)

					core.info(
						"Matrix lock: " + JSON.stringify(matrixLockArtifact)
					)

					shouldContinue = false

					for (let index = 0; index < retryCount; index++) {
						core.info(`Try: ${index + 1}/${retryCount}`)
						const downloadRespone =
							await artifactClient.downloadArtifact(
								matrixLockArtifact.artifact.id,
								workspace,
								{ continueOnError: false }
							)

						const lockFile = fs.readFileSync(fullPath, {
							encoding: "utf8",
						})

						if (id === lockFile.split(",")[0]) {
							shouldContinue = true
							break
						}

						await sleep(1000 * retryDelay)
					}

					if (!shouldContinue) {
						core.setFailed("Max retries reached")
						break
					}

					core.info("Lock ready")
				}
				break
			case "continue":
				{
					core.info("Continue")

					const matrixLockArtifact = await artifactClient.getArtifact(
						ARTIFACT_NAME
					)

					const downloadRespone =
						await artifactClient.downloadArtifact(
							matrixLockArtifact.artifact.id,
							workspace,
							{ continueOnError: false }
						)

					let lockFile = fs.readFileSync(fullPath, {
						encoding: "utf8",
					})
					lockFile = lockFile.split(",").slice(1).join(",")

					fs.writeFileSync(fullPath, lockFile)

					const uploadResponseB = await artifactClient.uploadArtifact(
						ARTIFACT_NAME,
						[fullPath],
						workspace,
						{ continueOnError: false }
					)

					core.info("Unlocking")
				}
				break
			default:
				{
					core.setFailed("Unkown step: " + step)
				}
				break
		}
	} catch (error) {
		core.setFailed(error.message)
	}
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

run()
