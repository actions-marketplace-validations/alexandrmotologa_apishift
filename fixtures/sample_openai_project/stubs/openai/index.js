class Configuration {
  constructor(opts = {}) {
    this.apiKey = opts.apiKey;
  }
}

class OpenAIApi {
  constructor(configuration) {
    this.configuration = configuration;
  }

  async createChatCompletion(params) {
    return {
      data: {
        choices: [
          {
            message: {
              content: 'legacy content',
            },
          },
        ],
      },
    };
  }
}

class OpenAI {
  constructor(opts = {}) {
    this.apiKey = opts.apiKey;
    this.chat = {
      completions: {
        create: async (params) => {
          return {
            choices: [
              {
                message: {
                  content: 'migrated content',
                },
              },
            ],
          };
        },
      },
    };
  }
}

module.exports = {
  Configuration,
  OpenAIApi,
  OpenAI,
  default: OpenAI,
};
